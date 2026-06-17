import { getBirthdatePassword } from '../../shared/utils/password.utils';

function assertEqual(actual: string, expected: string, testName: string) {
    if (actual === expected) {
        console.log(`[PASS] ${testName}: expected "${expected}", got "${actual}"`);
    } else {
        console.error(`[FAIL] ${testName}: expected "${expected}", got "${actual}"`);
        process.exit(1);
    }
}

console.log("Running birthdate password tests...");

// Test Case 1: Birthday: March 15, 2003 -> Default password: 031503
assertEqual(getBirthdatePassword("2003-03-15"), "031503", "March 15, 2003 (string YYYY-MM-DD)");

// Test Case 2: Birthday: July 9, 1999 -> Default password: 070999
assertEqual(getBirthdatePassword("1999-07-09"), "070999", "July 9, 1999 (string YYYY-MM-DD)");

// Test Case 3: Birthday: December 25, 2000 -> Default password: 122500
assertEqual(getBirthdatePassword("2000-12-25"), "122500", "December 25, 2000 (string YYYY-MM-DD)");

// Test Case 4: Date Object support
assertEqual(getBirthdatePassword(new Date("2003-03-15T00:00:00.000Z")), "031503", "March 15, 2003 Date Object");

console.log("All birthdate password tests passed successfully!");
