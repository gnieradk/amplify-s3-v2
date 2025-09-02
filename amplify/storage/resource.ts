import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'appUserFiles',
  access: (allow) => ({
    // Single global shared space for all authenticated users
    'shared/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
