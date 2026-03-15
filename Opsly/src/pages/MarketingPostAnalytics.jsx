import DashboardLayout from '../components/DashboardLayout'
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa'
import { HiThumbUp, HiChat, HiShare, HiEye } from 'react-icons/hi'
import { Link } from 'react-router-dom'

function MarketingPostAnalytics() {
  return (
    <DashboardLayout>
      <div>
        <Link to="/marketing" className="text-opsly-purple mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold text-white mb-8">Post Analytics</h1>

        {/* Post Details Card */}
        <div className="bg-opsly-card rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3">
              <div className="w-full h-64 rounded-lg flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500">
                <img
                  src="/Product.jpg"
                  alt="Product"
                  className="object-cover w-full h-full rounded-lg shadow-lg"
                  style={{ maxHeight: '16rem' }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex gap-4 mb-4">
                <FaFacebook className="text-2xl text-blue-500" />
                <FaInstagram className="text-2xl text-pink-500" />
                <FaLinkedin className="text-2xl text-blue-600" />
              </div>
              <p className="text-gray-300 mb-4">
                Excited to announce our new product launch! We've been working tirelessly to bring you the best experience possible. Stay tuned for more updates and exclusive features coming your way.
              </p>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span>Posted: Nov 29, 2024 - 2:30 PM</span>
                <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Posted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiThumbUp className="text-3xl text-blue-500" />
              <div>
                <p className="text-gray-400 text-sm">Likes</p>
                <p className="text-3xl font-bold text-white">1,245</p>
              </div>
            </div>
            <p className="text-green-500 text-sm font-semibold">+12%</p>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiChat className="text-3xl text-opsly-purple" />
              <div>
                <p className="text-gray-400 text-sm">Comments</p>
                <p className="text-3xl font-bold text-white">234</p>
              </div>
            </div>
            <p className="text-green-500 text-sm font-semibold">+8%</p>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiShare className="text-3xl text-green-500" />
              <div>
                <p className="text-gray-400 text-sm">Shares</p>
                <p className="text-3xl font-bold text-white">456</p>
              </div>
            </div>
            <p className="text-green-500 text-sm font-semibold">+15%</p>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiEye className="text-3xl text-orange-500" />
              <div>
                <p className="text-gray-400 text-sm">Views</p>
                <p className="text-3xl font-bold text-white">8,950</p>
              </div>
            </div>
            <p className="text-green-500 text-sm font-semibold">+22%</p>
          </div>
        </div>

        {/* Engagement Rate & Trending Keywords */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-opsly-card rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Engagement Rate</h3>
            <p className="text-4xl font-bold text-blue-400 mb-6">24.6%</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">Likes</span>
                  <span className="text-gray-300">33.9%</span>
                </div>
                <div className="w-full bg-opsly-dark rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '33.9%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">Comments</span>
                  <span className="text-gray-300">2.8%</span>
                </div>
                <div className="w-full bg-opsly-dark rounded-full h-2">
                  <div className="bg-opsly-purple h-2 rounded-full" style={{ width: '2.8%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">Shares</span>
                  <span className="text-gray-300">5.2%</span>
                </div>
                <div className="w-full bg-opsly-dark rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '5.2%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">Click-through</span>
                  <span className="text-gray-300">2.9%</span>
                </div>
                <div className="w-full bg-opsly-dark rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '2.9%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-opsly-card rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Hot Words & Trending Keywords</h3>
            <div className="space-y-3">
              {[
                { word: 'Product', mentions: 45 },
                { word: 'Launch', mentions: 39 },
                { word: 'Innovation', mentions: 23 },
                { word: 'Content', mentions: 28 },
                { word: 'Technology', mentions: 24 },
                { word: 'Future', mentions: 31 },
                { word: 'Amazing', mentions: 24 },
                { word: 'Team', mentions: 35 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-white">{item.word}</span>
                  </div>
                  <span className="text-gray-400">{item.mentions} mentions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default MarketingPostAnalytics

