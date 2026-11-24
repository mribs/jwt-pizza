import { sleep, check, group, fail } from "k6";
import http from "k6/http";
import jsonpath from "https://jslib.k6.io/jsonpath/1.0.2/index.js";

export const options = {
  cloud: {
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Scenario_1: {
      executor: "ramping-vus",
      gracefulStop: "30s",
      stages: [
        { target: 5, duration: "30s" },
        { target: 15, duration: "1m" },
        { target: 10, duration: "30s" },
        { target: 0, duration: "30s" },
      ],
      gracefulRampDown: "30s",
      exec: "scenario_1",
    },
  },
};

export function scenario_1() {
  let response;

  const vars = {};

  group("page_1 - https://pizza.mribs.click/", function () {
    // Login
    sleep(8.4);
    response = http.put(
      "https://pizza-service.mribs.click/api/auth",
      '{"email":"d@jwt.com","password":"diner"}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/json",
          origin: "https://pizza.mribs.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    if (
      !check(response, {
        "status equals 200": (response) => response.status.toString() === "200",
      })
    ) {
      console.log(response.body);
      fail("Login was *not* 200");
    }

    vars["token1"] = jsonpath.query(response.json(), "$.token")[0];

    sleep(14);

    // Get menu
    response = http.get("https://pizza-service.mribs.click/api/order/menu", {
      headers: {
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        authorization: `Bearer ${vars["token1"]}`,
        "cache-control": "no-cache",
        "content-type": "application/json",
        origin: "https://pizza.mribs.click",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
      },
    });

    // Get Franchise
    response = http.get(
      "https://pizza-service.mribs.click/api/franchise?page=0&limit=20&name=*",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token1"]}`,
          "cache-control": "no-cache",
          "content-type": "application/json",
          origin: "https://pizza.mribs.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    sleep(6.7);

    // IDK Get me?
    response = http.get("https://pizza-service.mribs.click/api/user/me", {
      headers: {
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        authorization: `Bearer ${vars["token1"]}`,
        "cache-control": "no-cache",
        "content-type": "application/json",
        origin: "https://pizza.mribs.click",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
      },
    });
    sleep(1.1);

    // Buy Pizza
    response = http.post(
      "https://pizza-service.mribs.click/api/order",
      '{"items":[{"menuId":2,"description":"Pepperoni","price":0.0042}],"storeId":"4","franchiseId":3}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token1"]}`,
          "cache-control": "no-cache",
          "content-type": "application/json",
          origin: "https://pizza.mribs.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    if (
      !check(response, {
        "status equals 200": (response) => response.status.toString() === "200",
      })
    ) {
      console.log(response.body);
      fail("Buy pizza was *not* 200");
    }
    const jwt = response.json().jwt;
    sleep(1.5);

    // Verify
    response = http.post(
      "https://pizza-factory.cs329.click/api/order/verify",
      `{"jwt":"${jwt}"}`,
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token1"]}`,
          "cache-control": "no-cache",
          "content-type": "application/json",
          origin: "https://pizza.mribs.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          "sec-fetch-storage-access": "active",
        },
      },
    );
  });
}
