const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const token = jwt.sign({
    employeeId: 4,
    role: 'USER',
    firstName: 'test2',
    lastName: 'yesman',
    name: 'test2 yesman'
}, JWT_SECRET, { expiresIn: '1h' });

console.log(token);
