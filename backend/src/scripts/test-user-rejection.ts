// Quick test to verify USER role is rejected
const testData = {
    email: 'frontend@test.com',  // This is a USER role
    password: 'test123'
};

console.log('🧪 Testing USER role rejection...');
console.log('Email:', testData.email);

fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testData),
})
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        if (data.success === false && data.message.includes('Access denied')) {
            console.log('\n✅ USER role correctly rejected!');
            console.log('Message:', data.message);
        } else {
            console.log('\n❌ Unexpected result');
            console.log(data);
        }
    })
    .catch(err => {
        console.error('\n❌ Error:', err.message);
    });