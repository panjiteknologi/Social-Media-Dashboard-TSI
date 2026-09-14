import { useSearchParams } from 'react-router-dom';

/** Keyed by the `auth_error` reasons the API redirects back with. */
const ERROR_MESSAGES: Record<string, string> = {
  not_allowed:
    'This Google account is not on the Content Machine user list. Ask an admin to add you.',
  unverified: 'Google has not verified this email address.',
  failed: 'Sign-in did not complete. Please try again.',
  not_configured: 'Google sign-in is not configured on this server yet.',
};

export function Login() {
  const [params] = useSearchParams();
  const error = params.get('auth_error');
  const message = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.failed) : null;

  return (
    <div className="full-page">
      <div className="login-card">
        <img className="login-card__logo" src="/assets/tsi-logo.png" alt="TSI" />
        <div className="login-card__title">Content Machine</div>
        <div className="login-card__text">Sign in with your Google account to continue.</div>
        {message ? (
          <div className="login-card__error" role="alert">
            {message}
          </div>
        ) : null}
        <a className="btn btn--primary login-card__action" href="/api/auth/google">
          Sign in with Google
        </a>
        {import.meta.env.DEV ? (
          <a className="login-card__dev" href="/api/auth/dev-login">
            Development sign-in
          </a>
        ) : null}
      </div>
    </div>
  );
}
