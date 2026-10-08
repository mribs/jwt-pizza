import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Role, User } from "../src/service/pizzaService";

async function basicInit(page: Page) {
  let nextStoreId = 1;
  let nextFranchiseId = 100;

  // Track global franchises in memory so admin create/delete persists
  let allFranchises = [
    {
      id: 2,
      name: "pizzaPocket",
      admins: [{ id: "2", name: "Princess Donut", email: "f@jwt.com" }],
      stores: [] as { id: number; name: string; totalRevenue: number }[],
    },
    {
      id: 3,
      name: "LotaPizza",
      admins: [],
      stores: [
        { id: 4, name: "Lehi", totalRevenue: 0 },
        { id: 5, name: "Springville", totalRevenue: 0 },
        { id: 6, name: "American Fork", totalRevenue: 0 },
      ],
    },
    {
      id: 4,
      name: "PizzaCorp",
      admins: [],
      stores: [{ id: 7, name: "Spanish Fork", totalRevenue: 0 }],
    },
    { id: 5, name: "topSpot", admins: [], stores: [] },
  ];

  const validUsers: Record<string, User> = {
    "d@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "d@jwt.com",
      password: "a",
      roles: [{ role: Role.Diner }],
    },
    "a@jwt.com": {
      id: "1",
      name: "Carl",
      email: "a@jwt.com",
      password: "admin",
      roles: [{ role: Role.Admin }],
    },
    "f@jwt.com": {
      id: "2",
      name: "Princess Donut",
      email: "f@jwt.com",
      password: "franchisee",
      roles: [{ role: Role.Franchisee }],
    },
  };

  let loggedInUser: User | undefined;

  await page.route("*/**/api/auth", async (route) => {
    const method = route.request().method();

    if (method === "PUT") {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      loggedInUser = validUsers[loginReq.email];
      const loginRes = {
        user: loggedInUser,
        token: "abcdef",
      };
      await route.fulfill({ json: loginRes });
      return;
    }

    if (method === "DELETE") {
      loggedInUser = undefined;
      await route.fulfill({ json: { message: "logout successful" } });
      return;
    }
  });

  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
      {
        id: 2,
        title: "Pepperoni",
        image: "pizza2.png",
        price: 0.0042,
        description: "Spicy treat",
      },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  // Support both GET (order history for diner dashboard) and POST (creating orders)
  await page.route(/\/api\/order(\?.*)?$/, async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        json: {
          dinerId: 3,
          orders: [],
          page: 1,
        },
      });
      return;
    }

    if (method === "POST") {
      const orderReq = route.request().postDataJSON();
      const orderRes = {
        order: { ...orderReq, id: 23 },
        jwt: "eyJpYXQ",
      };
      await route.fulfill({ json: orderRes });
      return;
    }
  });

  // Consolidated Franchise & Store routing
  await page.route(/\/api\/franchise(\/.*|\?.*)?$/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // 1. POST /api/franchise/:id/store -> Add store to franchise
    if (method === "POST" && url.includes("/store")) {
      const storeReq = route.request().postDataJSON();
      const franchiseMatch = url.match(/\/api\/franchise\/(\d+)\/store/);
      const franchiseId = franchiseMatch ? parseInt(franchiseMatch[1], 10) : 2;
      const franchise = allFranchises.find((f) => f.id === franchiseId);

      const newStore = {
        id: nextStoreId++,
        franchiseId,
        name: storeReq.name,
        totalRevenue: 0,
      };

      if (franchise) franchise.stores.push(newStore);
      await route.fulfill({ json: newStore });
      return;
    }

    // 2. DELETE /api/franchise/:franchiseId/store/:storeId -> Remove store
    if (method === "DELETE" && url.includes("/store/")) {
      const match = url.match(/\/store\/(\d+)/);
      if (match) {
        const storeId = parseInt(match[1], 10);
        allFranchises.forEach((f) => {
          f.stores = f.stores.filter((s) => s.id !== storeId);
        });
      }
      await route.fulfill({ json: { message: "store deleted" } });
      return;
    }

    // 3. POST /api/franchise -> Create new franchise (Admin)
    if (
      method === "POST" &&
      (url.endsWith("/franchise") || url.includes("/franchise?"))
    ) {
      const franchiseReq = route.request().postDataJSON();
      const newFranchise = {
        id: nextFranchiseId++,
        name: franchiseReq.name,
        admins: franchiseReq.admins || [
          {
            email: franchiseReq.admins?.[0]?.email || "a@jwt.com",
            id: "99",
            name: "Admin",
          },
        ],
        stores: [],
      };
      allFranchises.push(newFranchise);
      await route.fulfill({ json: newFranchise });
      return;
    }

    // 4. DELETE /api/franchise/:franchiseId -> Close franchise (Admin)
    if (method === "DELETE") {
      const match = url.match(/\/api\/franchise\/(\d+)$/);
      if (match) {
        const franchiseId = parseInt(match[1], 10);
        allFranchises = allFranchises.filter((f) => f.id !== franchiseId);
      }
      await route.fulfill({ json: { message: "franchise deleted" } });
      return;
    }

    // 5. GET /api/franchise/:userId -> Specific user dashboard
    if (
      method === "GET" &&
      (url.includes("/franchise/2") || url.includes("userId=2"))
    ) {
      const userFranchise = allFranchises.filter((f) => f.id === 2);
      await route.fulfill({ json: userFranchise });
      return;
    }

    // 6. GET /api/franchise -> Global franchise list
    await route.fulfill({
      json: {
        franchises: allFranchises,
      },
    });
  });

  await page.goto("/");
}

test("login, logout", async ({ page }) => {
  await basicInit(page);

  // login as Kai Chen
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // view diner page (Kai Chen's initials are KC)
  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();
  await page.getByRole("link", { name: "KC" }).click();
  await expect(page.getByRole("heading")).toContainText("Your pizza kitchen");
  await expect(page.getByRole("main")).toContainText("d@jwt.com");

  // logout
  await page.getByRole("link", { name: "Logout" }).click();
});

test("purchase with login", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("button", { name: "Order now" }).click();

  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  await page.getByPlaceholder("Email address").fill("d@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!",
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.getByRole("heading")).toContainText("So worth it");

  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  await expect(page.getByText("0.008")).toBeVisible();

  await expect(page.getByRole("heading")).toContainText(
    "Here is your JWT Pizza!",
  );
  await page.getByRole("button", { name: "Verify" }).click();
  await page.getByRole("button", { name: "Close" }).click();
});

test("Open, Close store as franchisee", async ({ page }) => {
  await basicInit(page);
  // go to franchise page
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByRole("main")).toContainText(
    "So you want a piece of the pie?",
  );
  // login
  await page.getByRole("link", { name: "login", exact: true }).click();
  await page.getByPlaceholder("Email address").fill("f@jwt.com");
  await page.getByPlaceholder("Password").fill("franchisee");
  await page.getByRole("button", { name: "Login" }).click();
  // create store
  await expect(
    page.getByRole("heading", { name: "pizzaPocket" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "Everything you need to run an JWT Pizza franchise. Your gateway to success.",
  );
  await page.getByRole("button", { name: "Create store" }).click();
  await page.getByRole("textbox", { name: "store name" }).click();
  await page.getByRole("textbox", { name: "store name" }).fill("test1");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("tbody")).toContainText("test1");
  // close store
  await page
    .getByRole("row", { name: "test1 0 ₿ Close" })
    .getByRole("button")
    .click();
  await expect(page.getByRole("heading")).toContainText("Sorry to see you go");
  await expect(page.getByRole("main")).toContainText(
    "Are you sure you want to close the pizzaPocket store test1 ? This cannot be restored. All outstanding revenue will not be refunded.",
  );
  await page.getByRole("button", { name: "Close" }).click();
});

test("Open, Close Franchise as admin", async ({ page }) => {
  await basicInit(page);

  // Login as admin first so the Admin link appears in the nav
  // login
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("a@jwt.com");
  await page.getByPlaceholder("Password").fill("admin");
  await page.getByRole("button", { name: "Login" }).click();

  // Navigate to Admin dashboard
  await expect(page.getByRole("heading")).toContainText("The web's best pizza");
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.locator("h2")).toContainText("Mama Ricci's kitchen");

  // Create franchise
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await page
    .getByRole("textbox", { name: "franchise name" })
    .fill("frontendTest");
  await page
    .getByRole("textbox", { name: "franchisee admin email" })
    .fill("a@jwt.com");
  await page.getByRole("button", { name: "Create" }).click();

  // Verify created franchise appears in the table by scoping to the row
  const franchiseRow = page.getByRole("row", { name: /frontendTest/ });
  await expect(franchiseRow).toBeVisible();

  // Click the "Close" button specific to the frontendTest row
  await franchiseRow.getByRole("button", { name: "Close" }).click();

  await expect(page.getByRole("heading")).toContainText("Sorry to see you go");
  await expect(page.getByRole("main")).toContainText(
    "Are you sure you want to close the frontendTest franchise? This will close all associated stores and cannot be restored. All outstanding revenue will not be refunded.",
  );
  await page.getByRole("button", { name: "Close" }).click();
});
