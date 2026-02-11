// Test login API endpoint with registered user
const testLogin = {
    email: 'frontend@test.com',
    password: 'test123'
};

console.log('🔐 Testing login with:', testLogin.email);

fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testLogin),
})
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log('\n✅ Login successful!');
            console.log('📊 Response:');
            console.log(JSON.stringify(data, null, 2));
            console.log('\n🔑 JWT Token (first 50 chars):', data.token.substring(0, 50) + '...');
        } else {
            console.log('\n❌ Login failed:', data.message);
        }
    })
    .catch(err => {
        console.error('\n❌ Error:', err.message);
    });