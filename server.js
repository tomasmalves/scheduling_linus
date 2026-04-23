const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ENDPOINT = 'https://pss-function.scheduling.athena.io/v1/graphql';
const LOCATION_ID = '21276-2';
const PRACTITIONER_ID = '21276-39';
const CONTEXT_ID = '21276';

const VISIT_TYPES = {
  new: {
    patientNewness: 'scheduling.athena.io/enumeration/patientnewness/generalnew',
    specialty: 'codesystem.scheduling.athena.io/specialty.canonical|Psychiatry',
    serviceTypeToken: 'codesystem.scheduling.athena.io/servicetype.canonical|20e218c8-49ab-4fc7-8c0a-9bb9e3d74ece',
  },
  existing: {
    patientNewness: 'scheduling.athena.io/enumeration/patientnewness/generalestablished',
    specialty: 'codesystem.scheduling.athena.io/specialty.canonical|Psychiatry',
    serviceTypeToken: 'codesystem.scheduling.athena.io/servicetype.canonical|295ffd7e-d4fb-4391-9584-e55d237a6c7c',
  },
};

async function gql(query, variables, headers = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', product: 'Consumer', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()).data;
}

async function getToken() {
  const data = await gql(
    `mutation($locationId: String, $practitionerId: String) {
      createConsumerWorkflowToken(locationId: $locationId, practitionerId: $practitionerId) {
        token
      }
    }`,
    { locationId: LOCATION_ID, practitionerId: PRACTITIONER_ID }
  );
  const token = data?.createConsumerWorkflowToken?.token;
  if (!token) throw new Error('Failed to obtain scheduling token');
  return token;
}

async function fetchDates(token, startAfter, startBefore, visit) {
  const data = await gql(
    `query($locationIds: [String!], $practitionerIds: [String!],
           $patientNewness: String, $specialty: String,
           $serviceTypeTokens: [String!]!, $startAfter: String!, $startBefore: String!) {
      searchAvailabilityDates(
        locationIds: $locationIds, practitionerIds: $practitionerIds,
        patientNewness: $patientNewness, specialty: $specialty,
        serviceTypeTokens: $serviceTypeTokens,
        startAfter: $startAfter, startBefore: $startBefore
      ) { date availability }
    }`,
    {
      locationIds: [LOCATION_ID],
      practitionerIds: [PRACTITIONER_ID],
      patientNewness: visit.patientNewness,
      specialty: visit.specialty,
      serviceTypeTokens: [visit.serviceTypeToken],
      startAfter,
      startBefore,
    },
    { 'x-scheduling-jwt': token, 'context-id': CONTEXT_ID }
  );
  return data?.searchAvailabilityDates ?? [];
}

function getMonth(offset) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 0));
  const iso = (d) => d.toISOString().split('T')[0];
  return {
    startAfter: `${iso(start)}T00:00:00Z`,
    startBefore: `${iso(end)}T23:59:59Z`,
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    monthLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/availability', async (req, res) => {
  try {
    const visit = VISIT_TYPES[req.query.type] || VISIT_TYPES.new;
    const { startAfter, startBefore, year, month, monthLabel } = getMonth(req.query.month === 'current' ? 0 : 1);
    const token = await getToken();
    const entries = await fetchDates(token, startAfter, startBefore, visit);
    const dates = entries.filter((e) => e.availability).map((e) => e.date).sort();
    res.json({ success: true, year, month, monthLabel, dates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch availability. Please try again.' });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
