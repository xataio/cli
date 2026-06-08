import { z } from 'zod';
import { DEFAULT_DATABASE_NAME } from './constants';

const CustomConfigSchema = z.object({
  issuer: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  clientSecret: z.string().optional(),
  clientId: z.string().optional()
});
export type CustomConfig = z.infer<typeof CustomConfigSchema>;

export const AuthProfileSchema = z.preprocess(
  (obj: any) => {
    // For backwards compatibility: if it has access token but no type, it's oidc
    // TODO: remove this in the future with a major version bump
    if (obj?.accessToken && !obj.type) {
      console.error(
        'The configuration file appears to be corrupted or in an invalid format.\n' +
          'To fix this issue, please run:\n\n' +
          '  xata auth login --force\n\n' +
          'This will re-authenticate and recreate your configuration file.'
      );

      return { ...obj, type: 'oidc' };
    }

    return obj;
  },
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('oidc'),
      accessToken: z.string(),
      refreshToken: z.string(),
      expiresAt: z.coerce.date(),
      customConfig: CustomConfigSchema.optional()
    }),
    z.object({
      type: z.literal('apiKey'),
      apiKey: z.string(),
      customConfig: CustomConfigSchema.optional()
    })
  ])
);
export type AuthProfile = z.infer<typeof AuthProfileSchema>;

/**
 * This is the global config for the CLI.
 *
 * Usual location of this file on *nix systems is ~/.config/${CLI_NAME}
 */
export const ConfigSchema = z.object({
  activeProfile: z.string().default('default'),
  profiles: z.record(z.string(), AuthProfileSchema).default({})
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * This is the config for a project.
 *
 * Usual location of this file is the root of the project.
 */
export const ProjectConfigSchema = z.object({
  organizationId: z.string().default(''),
  projectId: z.string().default('')
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * This is the config for a branch. Branch is a database server and a database name.
 *
 * Usual location of this file is the root of the project.
 */
export const BranchConfigSchema = z.object({
  branchId: z.string().default(''),
  branchName: z.string().default(''),
  databaseName: z.string().default(DEFAULT_DATABASE_NAME)
});
export type BranchConfig = z.infer<typeof BranchConfigSchema>;
