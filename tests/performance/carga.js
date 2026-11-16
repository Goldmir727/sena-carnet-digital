//prueba cuyo propósito es sobrecargar a frontend, no postgres ni api

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '15s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL =
  'https://3pvyvleulkjypce5tlhuytxn.93.127.217.129.sslip.io';

export default function () {
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    'HTTP 200': (r) => r.status === 200,
    'Tiempo menor a 1.5 segundos': (r) =>
      r.timings.duration < 1500,
  });

  sleep(1);
}
