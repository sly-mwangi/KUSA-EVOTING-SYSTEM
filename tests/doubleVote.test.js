const { By, until } = require("selenium-webdriver");
const { buildDriver } = require("./setup");

async function doubleVoteTest() {
  const driver = await buildDriver();

  try {
    // LOGIN
    await driver.get("http://localhost:3000/login");

    await driver
      .wait(until.elementLocated(By.css('[data-testid="login-email"]')), 10000)
      .sendKeys("1101.2025@Students.ku.ac.ke");
    await driver.findElement(By.name("password")).sendKeys("@Student123");
    await driver.findElement(By.css('button[type="submit"]')).click();

    await driver.wait(until.urlContains("dashboard"), 10000);

    // FIRST VOTE (Replace 'YOUR_POLL_ID' with a real UUID from your database)
    await driver.get("http://localhost:3000/vote/YOUR_POLL_ID");

    // Wait for a candidate to appear. Using ^= matches IDs starting with 'candidate-'
    await driver
      .wait(until.elementLocated(By.css('[data-testid^="candidate-"]')), 10000)
      .click();
    await driver
      .wait(until.elementLocated(By.css('[data-testid="vote-btn"]')), 5000)
      .click();

    await driver.sleep(2000);

    // TRY SECOND VOTE
    await driver.get("http://localhost:3000/vote/YOUR_POLL_ID");

    // Attempt to vote again
    await driver
      .wait(until.elementLocated(By.css('[data-testid^="candidate-"]')), 10000)
      .click();
    await driver
      .wait(until.elementLocated(By.css('[data-testid="vote-btn"]')), 5000)
      .click();

    // EXPECT ERROR MESSAGE
    await driver.wait(
      until.elementLocated(By.xpath("//*[contains(text(),'already voted')]")),
      10000,
    );

    console.log("DOUBLE VOTE TEST: PASSED");
  } catch (err) {
    console.log("DOUBLE VOTE TEST: FAILED");
    console.error(err);
  } finally {
    await driver.quit();
  }
}

doubleVoteTest();
