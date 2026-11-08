// Load amplify/backend.ts the way ampx does in the Amplify build (Node's native
// TypeScript support). Outside ampx the CDK context is missing, so reaching that
// error means every backend module resolved and parsed.
try {
  await import('../amplify/backend.ts');
  console.log('backend loaded');
} catch (e) {
  if (String(e.message).includes('amplify-backend-namespace')) {
    console.log('backend modules resolved (CDK context missing outside ampx, as expected)');
  } else {
    console.error(e);
    process.exit(1);
  }
}
