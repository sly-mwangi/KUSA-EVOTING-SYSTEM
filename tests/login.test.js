const { Builder, By, until } = require("selenium-webdriver");

async function loginTest() {
  let driver = await new Builder().forBrowser("chrome").build();

  try {
    // Open login page (route corrected in previous step)
    await driver.get("http://localhost:3000/login");

    // Wait for the identifier/email field and enter credentials.
    const identifierField = await driver.wait(
      until.elementLocated(By.css('[data-testid="login-email"]')),
      10000,
    );
    await identifierField.sendKeys("1101.2025@Students.ku.ac.ke");

    // Enter password
    await driver
      .wait(
        until.elementLocated(
          By.css('input[name="password"], input[type="password"], #password'),
        ),
        5000,
      )
      .sendKeys("@Student123");

    // Click login button
    await driver
      .wait(until.elementLocated(By.css('button[type="submit"]')), 5000)
      .click();

    // Wait for dashboard
    await driver.wait(until.urlContains("dashboard"), 10000);

    console.log("LOGIN TEST PASSED");
  } catch (err) {
    console.log("LOGIN TEST FAILED");
    console.error(err);
  } finally {
    await driver.quit();
  }
}

loginTest();
