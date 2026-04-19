import React from 'react';

interface FooterProps {
  currentPage: 'app' | 'privacy' | 'terms' | 'license' | 'contact';
  onPageChange: (page: 'app' | 'privacy' | 'terms' | 'license' | 'contact') => void;
}

export const Footer: React.FC<FooterProps> = ({ currentPage, onPageChange }) => {
  if (currentPage !== 'app') {
    return null; // Legal pages have their own layout
  }

  return (
    <footer style={{
      marginTop: '64px',
      paddingTop: '32px',
      paddingBottom: '32px',
      paddingLeft: '64px',
      paddingRight: '64px',
      backgroundColor: '#fafafa',
      borderTopLeftRadius: '48px',
      borderTopRightRadius: '48px'
    }}>
      <div className="max-w-6xl mx-auto">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* About */}
          <div>
            <h3 style={{ color: 'black', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              About
            </h3>
            <p style={{ color: '#717182', fontSize: '12px', lineHeight: '1.6' }}>
              Tomodachi Dream Image Converter is a fan-made tool for converting images to Tomodachi Life game format.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 style={{ color: 'black', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              Legal
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => onPageChange('privacy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FF8000',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  Privacy Policy
                </button>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => onPageChange('terms')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FF8000',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  Terms of Service
                </button>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => onPageChange('license')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FF8000',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  License & Copyright
                </button>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 style={{ color: 'black', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
              Support
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => onPageChange('contact')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FF8000',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '12px',
                    padding: 0
                  }}
                >
                  Contact
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/202alix/tlltd-converter"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#FF8000',
                    textDecoration: 'underline',
                    fontSize: '12px'
                  }}
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          paddingTop: '32px',
          fontSize: '11px',
          color: '#717182',
          lineHeight: '1.6'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Disclaimer:</strong> This is an unofficial, fan-made tool. Nintendo and Tomodachi Life are trademarks of Nintendo Co., Ltd.
            This project is not affiliated with, endorsed by, or created by Nintendo.
          </p>
          <p style={{ margin: '0' }}>
            © 2026 Tomodachi Dream Image Converter. Licensed under MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
};
