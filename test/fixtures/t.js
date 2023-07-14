"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAll = void 0;
const promises_1 = require("fs/promises");
const url_1 = require("url");
const testAll = async (which) => {
    const types = which
        ? [which]
        : (await (0, promises_1.readdir)(__dirname + '/node_modules')).filter(f => f && !f.startsWith('.'));
    const res = await Promise.all(types.map(async (pkg) => {
        return [
            pkg,
            await import(pkg)
                .then(({ whoami }) => whoami)
                .catch(e => [e.code, e.message]),
            await import(`${pkg}/sub.js`)
                .then(({ whoami }) => whoami)
                .catch(e => [e.code, e.message]),
            await import(`${pkg}/missing.js`)
                .then(({ whoami }) => whoami)
                .catch(e => [e.code, e.message]),
        ];
    }));
    return Object.fromEntries(res.map(([p, i, s, m]) => {
        return [p, [tofurl(i), tofurl(s), tofurl(m)]];
    }));
};
exports.testAll = testAll;
const tofurl = (s) => typeof s !== 'string'
    ? s
    : s.startsWith('file://')
        ? s
        : String((0, url_1.pathToFileURL)(s));
if (require.main === module) {
    (0, exports.testAll)(process.argv[2]).then(res => console.log(JSON.stringify(res, null, 2)));
}
//# sourceMappingURL=t.js.map