import InvitationSetup from './InvitationSetup';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const token=new URLSearchParams(window.location.hash.slice(1)).get('setup');
createRoot(document.getElementById('root')).render(token ? <InvitationSetup token={token}/> : <App/>);
