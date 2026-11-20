import React from 'react';
import ReactDOM from 'react-dom/client';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SiteRouter from './routes/SiteRouter';
import RouteMetadata from './seo/RouteMetadata';
import './index.css';

const application = (
  <React.StrictMode>
    <BrowserRouter>
      <RouteMetadata />
      <SiteRouter />
    </BrowserRouter>
  </React.StrictMode>
);

const root = document.getElementById('root');
if (root.dataset.prerendered === 'true') {
  hydrateRoot(root, application);
} else {
  ReactDOM.createRoot(root).render(application);
}
