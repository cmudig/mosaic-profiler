import { CreateNodesResultWithContext } from './plugins/internal-api';
import { ConfigurationResult, ConfigurationSourceMaps } from './utils/project-configuration-utils';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProjectGraph } from '../config/project-graph';
export declare class ProjectGraphError extends Error {
    #private;
    constructor(errors: Array<CreateNodesError | MergeNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError | ProcessDependenciesError | ProcessProjectGraphError | CreateMetadataError | WorkspaceValidityError>, partialProjectGraph: ProjectGraph, partialSourceMaps: ConfigurationSourceMaps);
    /**
     * The daemon cannot throw errors which contain methods as they are not serializable.
     *
     * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
     */
    static fromDaemonProjectGraphError(e: DaemonProjectGraphError): ProjectGraphError;
    /**
     * This gets the partial project graph despite the errors which occured.
     * This partial project graph may be missing nodes, properties of nodes, or dependencies.
     * This is useful mostly for visualization/debugging. It should not be used for running tasks.
     */
    getPartialProjectGraph(): ProjectGraph;
    getPartialSourcemaps(): ConfigurationSourceMaps;
    getErrors(): (CreateNodesError | MergeNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError | CreateMetadataError | ProcessDependenciesError | ProcessProjectGraphError | WorkspaceValidityError)[];
}
export declare class MultipleProjectsWithSameNameError extends Error {
    conflicts: Map<string, string[]>;
    projects: Record<string, ProjectConfiguration>;
    constructor(conflicts: Map<string, string[]>, projects: Record<string, ProjectConfiguration>);
}
export declare class ProjectWithExistingNameError extends Error {
    projectName: string;
    projectRoot: string;
    constructor(projectName: string, projectRoot: string);
}
export declare function isProjectWithExistingNameError(e: unknown): e is ProjectWithExistingNameError;
export declare function isMultipleProjectsWithSameNameError(e: unknown): e is MultipleProjectsWithSameNameError;
export declare class ProjectsWithNoNameError extends Error {
    projectRoots: string[];
    projects: Record<string, ProjectConfiguration>;
    constructor(projectRoots: string[], projects: Record<string, ProjectConfiguration>);
}
export declare function isProjectsWithNoNameError(e: unknown): e is ProjectsWithNoNameError;
export declare class ProjectWithNoNameError extends Error {
    projectRoot: string;
    constructor(projectRoot: string);
}
export declare function isProjectWithNoNameError(e: unknown): e is ProjectWithNoNameError;
export declare class ProjectConfigurationsError extends Error {
    readonly errors: Array<MergeNodesError | CreateNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError>;
    readonly partialProjectConfigurationsResult: ConfigurationResult;
    constructor(errors: Array<MergeNodesError | CreateNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError>, partialProjectConfigurationsResult: ConfigurationResult);
}
export declare function isProjectConfigurationsError(e: unknown): e is ProjectConfigurationsError;
export declare class CreateNodesError extends Error {
    file: string;
    pluginName: string;
    constructor({ file, pluginName, error, }: {
        file: string;
        pluginName: string;
        error: Error;
    });
}
export declare class AggregateCreateNodesError extends Error {
    readonly pluginName: string;
    readonly errors: Array<CreateNodesError>;
    readonly partialResults: Array<CreateNodesResultWithContext>;
    constructor(pluginName: string, errors: Array<CreateNodesError>, partialResults: Array<CreateNodesResultWithContext>);
}
export declare class MergeNodesError extends Error {
    file: string;
    pluginName: string;
    constructor({ file, pluginName, error, }: {
        file: string;
        pluginName: string;
        error: Error;
    });
}
export declare class CreateMetadataError extends Error {
    readonly error: Error;
    readonly plugin: string;
    constructor(error: Error, plugin: string);
}
export declare class ProcessDependenciesError extends Error {
    readonly pluginName: string;
    constructor(pluginName: string, { cause }: {
        cause: any;
    });
}
export declare class WorkspaceValidityError extends Error {
    message: string;
    constructor(message: string);
}
export declare function isWorkspaceValidityError(e: unknown): e is WorkspaceValidityError;
export declare class ProcessProjectGraphError extends Error {
    readonly pluginName: string;
    constructor(pluginName: string, { cause }: {
        cause: any;
    });
}
export declare class AggregateProjectGraphError extends Error {
    readonly errors: Array<CreateMetadataError | ProcessDependenciesError | ProcessProjectGraphError | WorkspaceValidityError>;
    readonly partialProjectGraph: ProjectGraph;
    constructor(errors: Array<CreateMetadataError | ProcessDependenciesError | ProcessProjectGraphError | WorkspaceValidityError>, partialProjectGraph: ProjectGraph);
}
export declare function isAggregateProjectGraphError(e: unknown): e is AggregateProjectGraphError;
export declare function isCreateMetadataError(e: unknown): e is CreateMetadataError;
export declare function isCreateNodesError(e: unknown): e is CreateNodesError;
export declare function isAggregateCreateNodesError(e: unknown): e is AggregateCreateNodesError;
export declare function isMergeNodesError(e: unknown): e is MergeNodesError;
export declare class DaemonProjectGraphError extends Error {
    errors: any[];
    readonly projectGraph: ProjectGraph;
    readonly sourceMaps: ConfigurationSourceMaps;
    constructor(errors: any[], projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps);
}
export declare class LoadPluginError extends Error {
    plugin: string;
    constructor(plugin: string, cause: Error);
}
