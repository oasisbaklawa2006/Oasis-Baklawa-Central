const API_URL = "https://api.oasisbaklawa.com/functions/v1/validate-user";

async function testUser(identifier, expectedFound) {
  const url = `${API_URL}?identifier=${encodeURIComponent(identifier)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("\nTesting:", identifier);
    console.log("Status:", response.status);
    console.log("Response:", data);

    if (response.status !== 200) {
      throw new Error("API did not return status 200");
    }

    if (typeof data.user_found !== "boolean") {
      throw new Error("user_found must be boolean");
    }

    if (data.identifier !== identifier) {
      throw new Error("identifier mismatch");
    }

    if (data.user_found !== expectedFound) {
      throw new Error(
        `Expected user_found=${expectedFound}, got ${data.user_found}`
      );
    }

    console.log("✅ Passed");
  } catch (error) {
    console.error("❌ Failed:", error.message);
  }
}

async function runTests() {
  await testUser("admin@oasisbaklawa.com", true);
  await testUser("test@example.com", false);
}

runTests();
