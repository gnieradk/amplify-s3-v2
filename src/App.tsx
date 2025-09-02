import { Authenticator, View, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './amplifyClient';

import FileBrowser from './components/FileBrowser';

export default function App() {
  return (
    <Authenticator signUpAttributes={['email']}>
      <Main />
    </Authenticator>
  );
}

function Main() {
  const { user, signOut } = useAuthenticator((ctx) => [ctx.user]);
  return (
    <View padding="1rem">
      <header style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between'}}>
        <h2>📁 Shared S3 File Browser</h2>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <span style={{fontSize:14}}>Signed in as <b>{user?.signInDetails?.loginId}</b></span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>
      <FileBrowser />
    </View>
  );
}
