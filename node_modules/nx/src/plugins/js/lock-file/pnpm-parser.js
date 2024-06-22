"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyPnpmLockfile = exports.getPnpmLockfileDependencies = exports.getPnpmLockfileNodes = void 0;
const pnpm_normalizer_1 = require("./utils/pnpm-normalizer");
const package_json_1 = require("./utils/package-json");
const object_sort_1 = require("../../../utils/object-sort");
const project_graph_builder_1 = require("../../../project-graph/project-graph-builder");
const project_graph_1 = require("../../../config/project-graph");
const file_hasher_1 = require("../../../hasher/file-hasher");
// we use key => node map to avoid duplicate work when parsing keys
let keyMap = new Map();
let currentLockFileHash;
let parsedLockFile;
function parsePnpmLockFile(lockFileContent, lockFileHash) {
    if (lockFileHash === currentLockFileHash) {
        return parsedLockFile;
    }
    keyMap.clear();
    const results = (0, pnpm_normalizer_1.parseAndNormalizePnpmLockfile)(lockFileContent);
    parsedLockFile = results;
    currentLockFileHash = lockFileHash;
    return results;
}
function getPnpmLockfileNodes(lockFileContent, lockFileHash) {
    const data = parsePnpmLockFile(lockFileContent, lockFileHash);
    const isV6 = (0, pnpm_normalizer_1.isV6Lockfile)(data);
    return getNodes(data, keyMap, isV6);
}
exports.getPnpmLockfileNodes = getPnpmLockfileNodes;
function getPnpmLockfileDependencies(lockFileContent, lockFileHash, ctx) {
    const data = parsePnpmLockFile(lockFileContent, lockFileHash);
    const isV6 = (0, pnpm_normalizer_1.isV6Lockfile)(data);
    return getDependencies(data, keyMap, isV6, ctx);
}
exports.getPnpmLockfileDependencies = getPnpmLockfileDependencies;
function matchPropValue(record, key, originalPackageName) {
    if (!record) {
        return undefined;
    }
    const index = Object.values(record).findIndex((version) => version === key);
    if (index > -1) {
        return Object.keys(record)[index];
    }
    // check if non-aliased name is found
    if (record[originalPackageName] &&
        key.startsWith(`/${originalPackageName}/${record[originalPackageName]}`)) {
        return originalPackageName;
    }
}
function matchedDependencyName(importer, key, originalPackageName) {
    return (matchPropValue(importer.dependencies, key, originalPackageName) ||
        matchPropValue(importer.optionalDependencies, key, originalPackageName) ||
        matchPropValue(importer.peerDependencies, key, originalPackageName));
}
function createHashFromSnapshot(snapshot) {
    return (snapshot.resolution?.['integrity'] ||
        (snapshot.resolution?.['tarball']
            ? (0, file_hasher_1.hashArray)([snapshot.resolution['tarball']])
            : undefined));
}
function isLockFileKey(depVersion) {
    return depVersion.startsWith('/');
}
function getNodes(data, keyMap, isV6) {
    const nodes = new Map();
    const maybeAliasedPackageVersions = new Map(); // <version, alias>
    const packageNames = new Set();
    for (const [key, snapshot] of Object.entries(data.packages)) {
        const originalPackageName = extractNameFromKey(key);
        if (!originalPackageName) {
            continue;
        }
        // snapshot already has a name
        if (snapshot.name) {
            packageNames.add({
                key,
                packageName: snapshot.name,
                hash: createHashFromSnapshot(snapshot),
            });
        }
        const rootDependencyName = matchedDependencyName(data.importers['.'], key, originalPackageName) ||
            // only root importers have devDependencies
            matchPropValue(data.importers['.'].devDependencies, key, originalPackageName);
        if (rootDependencyName) {
            packageNames.add({
                key,
                packageName: rootDependencyName,
                hash: createHashFromSnapshot(snapshot),
            });
        }
        if (!snapshot.name && !rootDependencyName) {
            packageNames.add({
                key,
                packageName: originalPackageName,
                hash: createHashFromSnapshot(snapshot),
            });
        }
        if (snapshot.peerDependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.peerDependencies)) {
                if (isLockFileKey(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        if (snapshot.optionalDependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.optionalDependencies)) {
                if (isLockFileKey(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        if (snapshot.dependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.dependencies)) {
                if (isLockFileKey(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        const aliasedDep = maybeAliasedPackageVersions.get(key);
        if (aliasedDep) {
            packageNames.add({
                key,
                packageName: aliasedDep,
                hash: createHashFromSnapshot(snapshot),
            });
        }
    }
    for (const { key, packageName, hash } of packageNames) {
        const rawVersion = findVersion(key, packageName);
        if (!rawVersion) {
            continue;
        }
        const version = parseBaseVersion(rawVersion, isV6);
        if (!version) {
            continue;
        }
        if (!nodes.has(packageName)) {
            nodes.set(packageName, new Map());
        }
        if (!nodes.get(packageName).has(version)) {
            const node = {
                type: 'npm',
                name: version ? `npm:${packageName}@${version}` : `npm:${packageName}`,
                data: {
                    version,
                    packageName,
                    hash: hash ?? (0, file_hasher_1.hashArray)([packageName, version]),
                },
            };
            nodes.get(packageName).set(version, node);
            keyMap.set(key, node);
        }
        else {
            keyMap.set(key, nodes.get(packageName).get(version));
        }
    }
    const hoistedDeps = (0, pnpm_normalizer_1.loadPnpmHoistedDepsDefinition)();
    const results = {};
    for (const [packageName, versionMap] of nodes.entries()) {
        let hoistedNode;
        if (versionMap.size === 1) {
            hoistedNode = versionMap.values().next().value;
        }
        else {
            const hoistedVersion = getHoistedVersion(hoistedDeps, packageName, isV6);
            hoistedNode = versionMap.get(hoistedVersion);
        }
        if (hoistedNode) {
            hoistedNode.name = `npm:${packageName}`;
        }
        versionMap.forEach((node) => {
            results[node.name] = node;
        });
    }
    return results;
}
function getHoistedVersion(hoistedDependencies, packageName, isV6) {
    let version = (0, package_json_1.getHoistedPackageVersion)(packageName);
    if (!version) {
        const key = Object.keys(hoistedDependencies).find((k) => k.startsWith(`/${packageName}/`));
        if (key) {
            version = parseBaseVersion(getVersion(key, packageName), isV6);
        }
        else {
            // pnpm might not hoist every package
            // similarly those packages will not be available to be used via import
            return;
        }
    }
    return version;
}
function getDependencies(data, keyMap, isV6, ctx) {
    const results = [];
    Object.entries(data.packages).forEach(([key, snapshot]) => {
        const node = keyMap.get(key);
        [snapshot.dependencies, snapshot.optionalDependencies].forEach((section) => {
            if (section) {
                Object.entries(section).forEach(([name, versionRange]) => {
                    const version = parseBaseVersion(findVersion(versionRange, name), isV6);
                    const target = ctx.externalNodes[`npm:${name}@${version}`] ||
                        ctx.externalNodes[`npm:${name}`];
                    if (target) {
                        const dep = {
                            source: node.name,
                            target: target.name,
                            type: project_graph_1.DependencyType.static,
                        };
                        (0, project_graph_builder_1.validateDependency)(dep, ctx);
                        results.push(dep);
                    }
                });
            }
        });
    });
    return results;
}
function parseBaseVersion(rawVersion, isV6) {
    return isV6 ? rawVersion.split('(')[0] : rawVersion.split('_')[0];
}
function stringifyPnpmLockfile(graph, rootLockFileContent, packageJson) {
    const data = (0, pnpm_normalizer_1.parseAndNormalizePnpmLockfile)(rootLockFileContent);
    const { lockfileVersion, packages } = data;
    const output = {
        lockfileVersion,
        importers: {
            '.': mapRootSnapshot(packageJson, packages, graph.externalNodes),
        },
        packages: (0, object_sort_1.sortObjectByKeys)(mapSnapshots(data.packages, graph.externalNodes)),
    };
    return (0, pnpm_normalizer_1.stringifyToPnpmYaml)(output);
}
exports.stringifyPnpmLockfile = stringifyPnpmLockfile;
function mapSnapshots(packages, nodes) {
    const result = {};
    Object.values(nodes).forEach((node) => {
        const matchedKeys = findOriginalKeys(packages, node, {
            returnFullKey: true,
        });
        // the package manager doesn't check for types of dependencies
        // so we can safely set all to prod
        matchedKeys.forEach(([key, snapshot]) => {
            snapshot.dev = false;
            result[key] = snapshot;
        });
    });
    return result;
}
function findOriginalKeys(packages, { data: { packageName, version } }, { returnFullKey } = {}) {
    const matchedKeys = [];
    for (const key of Object.keys(packages)) {
        const snapshot = packages[key];
        // standard package
        if (key.startsWith(`/${packageName}/${version}`)) {
            matchedKeys.push([
                returnFullKey ? key : getVersion(key, packageName),
                snapshot,
            ]);
        }
        // tarball package
        if (key === version) {
            matchedKeys.push([version, snapshot]);
        }
        // alias package
        if (versionIsAlias(key, version)) {
            matchedKeys.push([key, snapshot]);
        }
    }
    return matchedKeys;
}
// check if version has a form of npm:packageName@version and
// key starts with /packageName/version
function versionIsAlias(key, versionExpr) {
    const PREFIX = 'npm:';
    if (!versionExpr.startsWith(PREFIX))
        return false;
    const indexOfVersionSeparator = versionExpr.indexOf('@', PREFIX.length + 1);
    const packageName = versionExpr.slice(PREFIX.length, indexOfVersionSeparator);
    const version = versionExpr.slice(indexOfVersionSeparator + 1);
    return key.startsWith(`/${packageName}/${version}`);
}
function mapRootSnapshot(packageJson, packages, nodes) {
    const snapshot = { specifiers: {} };
    [
        'dependencies',
        'optionalDependencies',
        'devDependencies',
        'peerDependencies',
    ].forEach((depType) => {
        if (packageJson[depType]) {
            Object.keys(packageJson[depType]).forEach((packageName) => {
                const version = packageJson[depType][packageName];
                const node = nodes[`npm:${packageName}@${version}`] || nodes[`npm:${packageName}`];
                snapshot.specifiers[packageName] = version;
                // peer dependencies are mapped to dependencies
                let section = depType === 'peerDependencies' ? 'dependencies' : depType;
                snapshot[section] = snapshot[section] || {};
                snapshot[section][packageName] = findOriginalKeys(packages, node)[0][0];
            });
        }
    });
    Object.keys(snapshot).forEach((key) => {
        snapshot[key] = (0, object_sort_1.sortObjectByKeys)(snapshot[key]);
    });
    return snapshot;
}
function findVersion(key, packageName) {
    if (key.startsWith(`/${packageName}/`)) {
        return getVersion(key, packageName);
    }
    // for alias packages prepend with "npm:"
    if (key.startsWith('/')) {
        const aliasName = key.slice(1, key.lastIndexOf('/'));
        const version = getVersion(key, aliasName);
        return `npm:${aliasName}@${version}`;
    }
    // for tarball package the entire key is the version spec
    return key;
}
function getVersion(key, packageName) {
    const KEY_NAME_SEPARATOR_LENGTH = 2; // leading and trailing slash
    return key.slice(packageName.length + KEY_NAME_SEPARATOR_LENGTH);
}
function extractNameFromKey(key) {
    // if package name contains org e.g. "/@babel/runtime/7.12.5"
    // we want slice until the third slash
    if (key.startsWith('/@')) {
        // find the position of the '/' after org name
        const startFrom = key.indexOf('/', 1);
        return key.slice(1, key.indexOf('/', startFrom + 1));
    }
    if (key.startsWith('/')) {
        // if package has just a name e.g. "/react/7.12.5..."
        return key.slice(1, key.indexOf('/', 1));
    }
    return key;
}
