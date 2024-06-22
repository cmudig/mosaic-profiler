"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCreateNodesInParallel = exports.normalizeNxPlugin = exports.isNxPluginV1 = exports.isNxPluginV2 = void 0;
const node_path_1 = require("node:path");
const to_project_name_1 = require("../../config/to-project-name");
const globs_1 = require("../../utils/globs");
const error_types_1 = require("../error-types");
const perf_hooks_1 = require("perf_hooks");
function isNxPluginV2(plugin) {
    return 'createNodes' in plugin || 'createDependencies' in plugin;
}
exports.isNxPluginV2 = isNxPluginV2;
function isNxPluginV1(plugin) {
    return 'processProjectGraph' in plugin || 'projectFilePatterns' in plugin;
}
exports.isNxPluginV1 = isNxPluginV1;
function normalizeNxPlugin(plugin) {
    if (isNxPluginV2(plugin)) {
        return plugin;
    }
    if (isNxPluginV1(plugin) && plugin.projectFilePatterns) {
        return {
            ...plugin,
            createNodes: [
                `*/**/${(0, globs_1.combineGlobPatterns)(plugin.projectFilePatterns)}`,
                (configFilePath) => {
                    const root = (0, node_path_1.dirname)(configFilePath);
                    return {
                        projects: {
                            [root]: {
                                name: (0, to_project_name_1.toProjectName)(configFilePath),
                                targets: plugin.registerProjectTargets?.(configFilePath),
                            },
                        },
                    };
                },
            ],
        };
    }
    return plugin;
}
exports.normalizeNxPlugin = normalizeNxPlugin;
async function runCreateNodesInParallel(configFiles, plugin, options, context) {
    perf_hooks_1.performance.mark(`${plugin.name}:createNodes - start`);
    const errors = [];
    const results = [];
    const promises = configFiles.map(async (file) => {
        try {
            const value = await plugin.createNodes[1](file, options, context);
            if (value) {
                results.push({
                    ...value,
                    file,
                    pluginName: plugin.name,
                });
            }
        }
        catch (e) {
            errors.push(new error_types_1.CreateNodesError({
                error: e,
                pluginName: plugin.name,
                file,
            }));
        }
    });
    await Promise.all(promises).then(() => {
        perf_hooks_1.performance.mark(`${plugin.name}:createNodes - end`);
        perf_hooks_1.performance.measure(`${plugin.name}:createNodes`, `${plugin.name}:createNodes - start`, `${plugin.name}:createNodes - end`);
    });
    if (errors.length > 0) {
        throw new error_types_1.AggregateCreateNodesError(plugin.name, errors, results);
    }
    return results;
}
exports.runCreateNodesInParallel = runCreateNodesInParallel;
