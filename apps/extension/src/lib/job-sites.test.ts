import { describe, expect, it } from 'vitest';
import { detectJobSite, jobSiteMatches } from './job-sites';

describe('detectJobSite', () => {
  it.each([
    ['https://www.linkedin.com/jobs/view/4012345678/', 'linkedin'],
    ['https://fr.linkedin.com/jobs/view/senior-product-manager-at-acme-4012345678', 'linkedin'],
    ['https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=pm', 'linkedin'],
    ['https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678', 'linkedin'],
    ['https://fr.indeed.com/viewjob?jk=a1b2c3d4e5f6', 'indeed'],
    ['https://fr.indeed.com/jobs?q=product+manager&l=Paris&vjk=a1b2c3d4e5f6', 'indeed'],
    ['https://www.indeed.com/m/viewjob?jk=a1b2c3d4e5f6', 'indeed'],
    [
      'https://www.welcometothejungle.com/fr/companies/acme/jobs/senior-product-manager_paris',
      'wttj',
    ],
  ])('reconnaît une offre sur %s', (url, site) => {
    expect(detectJobSite(url)).toBe(site);
  });

  it.each([
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/jobs/search/?keywords=pm',
    'https://fr.indeed.com/jobs?q=product+manager',
    'https://www.welcometothejungle.com/fr/companies/acme',
    'https://www.welcometothejungle.com/fr/jobs?query=pm',
    'https://notlinkedin.com/jobs/view/4012345678/',
    'http://www.linkedin.com/jobs/view/4012345678/',
    'chrome://extensions',
    'pas une url',
    undefined,
  ])("ne voit pas d'offre sur %s", (url) => {
    expect(detectJobSite(url)).toBeNull();
  });
});

describe('jobSiteMatches', () => {
  it('couvre chaque site et ses sous-domaines', () => {
    expect(jobSiteMatches()).toEqual([
      'https://*.linkedin.com/*',
      'https://*.indeed.com/*',
      'https://*.welcometothejungle.com/*',
    ]);
  });
});
