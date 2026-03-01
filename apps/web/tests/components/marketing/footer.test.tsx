import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '@/components/marketing/footer';

describe('Footer', () => {
  it('renders the Support Helper brand', () => {
    render(<Footer />);
    const brands = screen.getAllByText('Support Helper');
    expect(brands.length).toBeGreaterThan(0);
  });

  it('renders the Pricing link', () => {
    render(<Footer />);
    const pricingLinks = screen.getAllByText('Pricing');
    expect(pricingLinks.length).toBeGreaterThan(0);
  });

  it('renders copyright information', () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it('renders the Privacy link', () => {
    render(<Footer />);
    const privacyLinks = screen.getAllByText('Privacy');
    expect(privacyLinks.length).toBeGreaterThan(0);
  });

  it('renders the Terms link', () => {
    render(<Footer />);
    const termsLinks = screen.getAllByText('Terms');
    expect(termsLinks.length).toBeGreaterThan(0);
  });
});
