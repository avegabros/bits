
async function main() {
    const loginUrl = 'http://localhost:3001/api/auth/login';
    const employeesUrl = 'http://localhost:3001/api/employees';

    try {
        console.log('Logging in...');
        const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@avegabros.com', password: 'admin123' })
        });

        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error('Login failed:', loginData);
            return;
        }
        const token = loginData.accessToken;

        console.log('Fetching employees...');
        const res = await fetch(employeesUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        console.log('API Response Success:', data.success);
        if (data.success) {
            console.log('Employee count:', data.employees?.length);
            if (data.employees?.length > 0) {
                console.log('First employee sample:', JSON.stringify(data.employees[0], null, 2));
            }
        } else {
            console.log('API Error:', data.message);
        }
    } catch (error) {
        console.error('Script error:', error);
    }
}

main();
