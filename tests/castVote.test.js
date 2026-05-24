const { By, until } = require("selenium-webdriver");
const { buildDriver } = require("./setup");

async function castVoteTest() {
  const driver = await buildDriver();

  try {
    // LOGIN FIRST (adjust selectors)
    await driver.get("http://localhost:3000/login");

    await driver
      .wait(until.elementLocated(By.css('[data-testid="login-email"]')), 10000)
      .sendKeys("1101.2025@Students.ku.ac.ke");
    await driver.findElement(By.name("password")).sendKeys("@Student123");
    await driver.findElement(By.css('button[type="submit"]')).click();

    // WAIT DASHBOARD
    await driver.wait(until.urlContains("dashboard"), 10000);

    // GO TO VOTING PAGE
    // The route in App.tsx is "/vote/:pollId".
    // You must replace 'REPLACE_WITH_REAL_POLL_UUID' with a real ID from your database.
    await driver.get("http://localhost:3000/vote/REPLACE_WITH_REAL_POLL_UUID");

    // SELECT CANDIDATE (CHANGE SELECTOR)
    // Using ^= "candidate-" to find the first available candidate regardless of their UUID
    await driver.wait(
      until.elementLocated(By.css('[data-testid^="candidate-"]')),
      10000,
    );
    await driver.findElement(By.css('[data-testid^="candidate-"]')).click();

    // SUBMIT VOTE
    await driver.findElement(By.css('[data-testid="vote-btn"]')).click();

    // VERIFY SUCCESS MESSAGE
    await driver.wait(
      until.elementLocated(By.xpath("//*[contains(text(),'Vote submitted')]")),
      10000,
    );

    console.log("CAST VOTE TEST: PASSED");
  } catch (err) {
    console.log("CAST VOTE TEST: FAILED");
    console.error(err);
  } finally {
    await driver.quit();
  }
}

castVoteTest();
