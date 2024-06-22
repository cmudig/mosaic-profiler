import { ProjectGraph, TargetConfiguration, Tree, CreateNodes } from 'nx/src/devkit-exports';
type PluginOptionsBuilder<T> = (targetName: string) => T;
type PostTargetTransformer = (targetConfiguration: TargetConfiguration, tree?: Tree, projectDetails?: {
    projectName: string;
    root: string;
}) => TargetConfiguration;
type SkipTargetFilter = (targetConfiguration: TargetConfiguration) => [boolean, string];
export declare function migrateExecutorToPlugin<T>(tree: Tree, projectGraph: ProjectGraph, executor: string, pluginPath: string, pluginOptionsBuilder: PluginOptionsBuilder<T>, postTargetTransformer: PostTargetTransformer, createNodes: CreateNodes<T>, specificProjectToMigrate?: string, skipTargetFilter?: SkipTargetFilter): Promise<Map<string, Set<string>>>;
export {};
