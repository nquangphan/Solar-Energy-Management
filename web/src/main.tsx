// Entry tối thiểu để `vite build` ra bundle thật (TD-1). CHƯA phải composition
// root: chưa router, chưa port HTTP, chưa đăng nhập thật — shell demo chỉ nối hai
// màn auth bằng fake port có sẵn (FakePasswordPort), không gọi mạng.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Thứ tự nạp là hợp đồng (gating/index.ts, a11y.css): a11y.css PHẢI sau components + shell.
import './design-system/tokens/tokens.css';
import './design-system/icons/icons.css';
import './design-system/components/components.css';
import './design-system/shell/shell.css';
import './design-system/a11y/a11y.css';

import { ICON_SPRITE } from './design-system/icons/sprite';
import { FakePasswordPort } from './design-system/session';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
import { LoginScreen } from './screens/auth/LoginScreen';

const demoPasswordPort = new FakePasswordPort();

function DemoShell() {
  const [man, setMan] = useState<'login' | 'forgot'>('login');
  return man === 'login' ? (
    <LoginScreen onForgotPassword={() => setMan('forgot')} />
  ) : (
    <ForgotPasswordScreen port={demoPasswordPort} onBackToLogin={() => setMan('login')} />
  );
}

// Sprite icon gắn MỘT lần, con đầu của <body> (hợp đồng trong sprite.ts).
document.body.insertAdjacentHTML('afterbegin', ICON_SPRITE);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoShell />
  </StrictMode>,
);
