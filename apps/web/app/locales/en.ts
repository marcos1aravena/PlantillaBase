import type { Dictionary } from './es';
export const en = {
  'nav.home': 'Home', 'nav.profile': 'My profile', 'nav.users': 'Users', 'nav.logout': 'Sign out',
  'roles.SUPERADMIN': 'Super administrator', 'roles.ADMIN': 'Administrator', 'roles.USER': 'User',
  'common.loading': 'Loading…', 'common.saving': 'Saving…', 'common.cancel': 'Cancel', 'common.retry': 'Retry',
  'fields.name': 'Name', 'fields.email': 'Email address', 'fields.role': 'Role', 'fields.status': 'Status', 'fields.password': 'Password',
  'status.active': 'Active', 'status.inactive': 'Inactive',
  'home.label': 'HOME', 'home.greeting': 'Hello,', 'home.welcome': 'Welcome to your workspace.', 'home.account': 'Your account', 'home.security': 'JWT-protected session · Role:',
  'profile.label': 'ACCOUNT', 'profile.description': 'View and update your personal information.', 'profile.account': 'Account information', 'profile.registered': 'Registration date',
  'profile.readonly': 'Email address and role cannot be changed from your profile.', 'profile.nameHelp': 'Update the name associated with your account.', 'profile.saveName': 'Save name', 'profile.nameSaved': 'Name updated successfully.',
  'profile.changePassword': 'Change password', 'profile.passwordHelp': 'For security, confirm your current password. Your new password must be at least 12 characters.', 'profile.currentPassword': 'Current password', 'profile.newPassword': 'New password', 'profile.passwordRevokes': 'Changing your password will sign you out on all devices.',
  'profile.sessions': 'Sessions', 'profile.revoke': 'Sign out of all sessions', 'profile.revokeConfirm': 'Sign out of all sessions, including this one?', 'profile.sessionsHelp': 'Sign out on all devices, including this one.',
  'users.label': 'ADMINISTRATION', 'users.description': 'Manage accounts and their permissions.', 'users.create': 'Create user', 'users.editTitle': 'Edit user', 'users.edit': 'Edit', 'users.delete': 'Delete', 'users.actions': 'Actions', 'users.save': 'Save user',
  'users.created': 'User created successfully.', 'users.updated': 'User updated successfully.', 'users.optionalPassword': 'New password (optional)', 'users.passwordLabel': 'Password (at least 12 characters)', 'users.keepPassword': 'Leave blank to keep the current password.', 'users.deleteConfirm': 'Permanently delete {name}?', 'users.empty': 'No users to display.',
  'pagination.limit': 'Items per page', 'pagination.previous': 'Previous', 'pagination.next': 'Next', 'pagination.summary': 'Page {page} of {pages} · {total} users',
  'login.welcome': 'Welcome', 'login.description': 'Sign in to continue.', 'login.submitting': 'Signing in…', 'login.submit': 'Sign in', 'login.help': 'Access is only available to accounts created by an administrator.',
  'errors.connection': 'Could not connect to the server.', 'errors.forbidden': 'You are not allowed to perform this action.', 'errors.session': 'Session expired or invalid.', 'errors.internal': 'Internal server error.', 'errors.profile': 'Could not update profile.', 'errors.update': 'Could not update user.',
} satisfies Dictionary;
