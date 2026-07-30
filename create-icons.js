const fs = require('fs');
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY3jP4PgfAAWpA50G65xAAAAAAElFTkSuQmCC";
const buf = Buffer.from(pngBase64, 'base64');
fs.writeFileSync('icons/icon16.png', buf);
fs.writeFileSync('icons/icon48.png', buf);
fs.writeFileSync('icons/icon128.png', buf);
console.log('Placeholder icons created.');
