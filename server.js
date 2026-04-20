const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const GRAPHQL_ENDPOINT = 'https://pss-function.scheduling.athena.io/v1/graphql';
const LOCATION_ID = '21276-2';
const PRACTITIONER_ID = '21276-39';
const CONTEXT_ID = '21276';

const VISIT_CONFIGS = [
  {
    label: 'Behavioral Health - Telehealth (Existing Patient)',
    patientNewness: 'scheduling.athena.io/enumeration/patientnewness/generalestablished',
    specialty: 'codesystem.scheduling.athena.io/specialty.canonical|Psychiatry',
    serviceTypeToken: 'codesystem.scheduling.athena.io/servicetype.canonical|295ffd7e-d4fb-4391-9584-e55d237a6c7c',
  },
  {
    label: 'New Patient - Telehealth',
    patientNewness: 'scheduling.athena.io/enumeration/patientnewness/generalnew',
    specialty: 'codesystem.scheduling.athena.io/specialty.canonical|Psychiatry',
    serviceTypeToken: 'codesystem.scheduling.athena.io/servicetype.canonical|20e218c8-49ab-4fc7-8c0a-9bb9e3d74ece',
  },
];

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', product: 'Consumer' },
    body: JSON.stringify({
      operationName: 'createConsumerWorkflowToken',
      variables: { locationId: LOCATION_ID, practitionerId: PRACTITIONER_ID },
      query: `mutation createConsumerWorkflowToken($locationId: String, $practitionerId: String, $contextId: String) {
        createConsumerWorkflowToken(locationId: $locationId, practitionerId: $practitionerId, contextId: $contextId) {
          token
          expiresIn
          status
          retryAfter
          __typename
        }
      }`,
    }),
  });

  const data = await res.json();
  const jwt = data?.data?.createConsumerWorkflowToken;
  if (!jwt?.token) throw new Error('Failed to obtain scheduling token');

  tokenCache = {
    token: jwt.token,
    expiresAt: Date.now() + (jwt.expiresIn - 30) * 1000,
  };
  return tokenCache.token;
}

async function fetchAvailabilityDates(token, startAfter, startBefore, config) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scheduling-jwt': token,
      'context-id': CONTEXT_ID,
      product: 'Consumer',
    },
    body: JSON.stringify({
      operationName: 'SearchAvailabilityDates',
      variables: {
        locationIds: [LOCATION_ID],
        practitionerIds: [PRACTITIONER_ID],
        page: 1,
        patientNewness: config.patientNewness,
        specialty: config.specialty,
        serviceTypeTokens: [config.serviceTypeToken],
        startAfter,
        startBefore,
      },
      query: `query SearchAvailabilityDates(
        $locationIds: [String!], $practitionerIds: [String!],
        $patientNewness: String, $specialty: String,
        $serviceTypeTokens: [String!]!, $startAfter: String!, $startBefore: String!,
        $visitType: VisitType, $page: Int, $practitionerCategory: PractitionerCategory
      ) {
        searchAvailabilityDates(
          locationIds: $locationIds, practitionerIds: $practitionerIds,
          patientNewness: $patientNewness, specialty: $specialty,
          serviceTypeTokens: $serviceTypeTokens, startAfter: $startAfter,
          startBefore: $startBefore, visitType: $visitType,
          page: $page, practitionerCategory: $practitionerCategory
        ) { date availability __typename }
      }`,
    }),
  });

  const data = await res.json();
  return data?.data?.searchAvailabilityDates ?? [];
}

function getMonthRange(monthOffset) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));

  const fmt = (d) => d.toISOString().split('T')[0];
  return {
    startAfter: `${fmt(start)}T00:00:00-07:00`,
    startBefore: `${fmt(end)}T23:59:59-07:00`,
    monthLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    firstDay: fmt(start),
    lastDay: fmt(end),
  };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/availability', async (req, res) => {
  const monthParam = req.query.month || 'next';
  const monthOffset = monthParam === 'current' ? 0 : 1;

  try {
    const token = await getToken();
    const range = getMonthRange(monthOffset);

    const results = await Promise.all(
      VISIT_CONFIGS.map((cfg) =>
        fetchAvailabilityDates(token, range.startAfter, range.startBefore, cfg)
      )
    );

    const availableSet = new Set();
    for (const dateList of results) {
      for (const entry of dateList) {
        if (entry.availability && entry.date >= range.firstDay && entry.date <= range.lastDay) {
          availableSet.add(entry.date);
        }
      }
    }

    const availableDates = [...availableSet].sort();

    res.json({
      success: true,
      practitioner: 'Emani Cheng, PMHNP',
      location: 'HILLSBORO',
      monthLabel: range.monthLabel,
      year: range.year,
      month: range.month,
      firstDay: range.firstDay,
      lastDay: range.lastDay,
      dates: availableDates,
    });
  } catch (err) {
    console.error('Availability fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch availability. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
