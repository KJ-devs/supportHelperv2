import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavBar } from '@/components/marketing/nav-bar';

describe('NavBar', () => {
  it('renders the logo text', () => {
    render(<NavBar />);
    expect(screen.getByText('Support Helper')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<NavBar />);
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('renders the Get Started CTA', () => {
    render(<NavBar />);
    const getStartedLinks = screen.getAllByText('Get Started');
    expect(getStartedLinks.length).toBeGreaterThan(0);
  });

  it('renders the Login link', () => {
    render(<NavBar />);
    const loginLinks = screen.getAllByText('Login');
    expect(loginLinks.length).toBeGreaterThan(0);
  });
});
