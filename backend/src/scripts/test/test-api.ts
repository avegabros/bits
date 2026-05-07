// Test registration API endpoint
const testData1 = {
    name: 'Frontend Test User',
    email: 'frontend@test.com',
    password: 'test123',
    role: 'USER'
};

fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testData1),
})
    .then(res => res.json())
    .then(data => {
        console.log('✅ Registration successful!');
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => {
        console.error('❌ Registration failed:', err.message);
    });
