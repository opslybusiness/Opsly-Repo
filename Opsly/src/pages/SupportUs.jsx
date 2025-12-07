import DashboardLayout from '../components/DashboardLayout'
import { HiHeart, HiQrcode } from 'react-icons/hi'

function SupportUs() {
  return (
    <DashboardLayout userName="Friend">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HiHeart className="text-opsly-purple text-4xl" />
            <h1 className="text-4xl font-bold text-white">Support Us</h1>
            <HiHeart className="text-opsly-purple text-4xl" />
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            If you find this project helpful, you can support its development by sending a small contribution.
            Your support helps us continue building amazing features!
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-opsly-card rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center border border-gray-800 shadow-xl">
          {/* QR Code Section */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <HiQrcode className="text-opsly-purple text-2xl" />
              <h2 className="text-2xl font-semibold text-white">Scan to Support</h2>
            </div>
            
            {/* QR Image Container - Responsive and properly fitted */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg mb-4 max-w-sm mx-auto">
              <div className="w-full aspect-square bg-opsly-dark rounded-xl flex items-center justify-center overflow-hidden">
                <img
                  src="/qr-support.jpeg"
                  alt="Support us QR code"
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
            </div>

            <p className="text-gray-300 text-center text-sm md:text-base max-w-md mx-auto leading-relaxed">
              Point your payment app's scanner (easypaisa, jazzcash, or bank account) at this QR code to support us.
            </p>
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-700 w-full max-w-md">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">
                Thank you for your generosity! 💜
              </p>
              <p className="text-gray-500 text-xs">
                Every contribution, no matter how small, helps us improve and maintain this project.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default SupportUs
