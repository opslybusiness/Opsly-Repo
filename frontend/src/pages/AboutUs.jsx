import { Link } from 'react-router-dom'
import { FaRobot, FaChartBar, FaHeadset, FaShieldAlt, FaLightbulb, FaRocket } from 'react-icons/fa'
import { HiChat } from 'react-icons/hi'

function AboutUs() {
  return (
    <div className="min-h-screen bg-opsly-dark relative">
      {/* Vertical Lines Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 100px)',
          backgroundSize: '100px 100%'
        }}
      ></div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 md:px-16 py-4 sm:py-6 relative z-10 flex-wrap gap-4">
        <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
          <Link to="/" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition">
            <span className="text-opsly-purple">Öps</span><span className="text-white">ly</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 lg:gap-8">
            <Link to="/about-us" className="text-white hover:text-opsly-purple transition text-sm lg:text-base">
              About Us
            </Link>
            <Link to="/chat" className="flex items-center gap-2 text-white hover:text-opsly-purple transition text-sm lg:text-base">
              <HiChat className="text-base lg:text-lg flex-shrink-0" />
              <span>Chat Support</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link to="/chat" className="md:hidden flex items-center gap-1 text-white hover:text-opsly-purple transition text-sm p-2">
            <HiChat className="text-base flex-shrink-0" />
          </Link>
          <Link to="/signup" className="px-3 sm:px-6 py-2 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg hover:opacity-90 transition text-sm sm:text-base whitespace-nowrap">
            Sign Up
          </Link>
          <Link to="/login" className="px-3 sm:px-6 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-opsly-dark transition text-sm sm:text-base whitespace-nowrap">
            Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-12 md:py-16">
        {/* Hero Section */}
        <section className="text-center mb-12 sm:mb-16 md:mb-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 sm:mb-6">
            <span className="bg-gradient-to-r from-white to-opsly-purple bg-clip-text text-transparent">
              About Öpsly
            </span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Empowering businesses with intelligent automation and data-driven decision making
          </p>
        </section>

        {/* Mission Section */}
        <section className="mb-12 sm:mb-16 md:mb-20">
          <div className="bg-opsly-card rounded-xl p-6 sm:p-8 md:p-10 border border-gray-700">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
              Our Mission
            </h2>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
              At Öpsly, we believe that every business deserves access to powerful automation tools and intelligent analytics. Our mission is to democratize advanced business intelligence, making it accessible to companies of all sizes.
            </p>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
              We're committed to helping businesses streamline their operations, enhance customer experiences, and make data-driven decisions that drive growth and success.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-8 sm:mb-10 text-center">
            What We Offer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* AI-Powered Support */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaRobot className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">AI-Powered Support</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Advanced chatbot solutions that provide instant, intelligent customer support 24/7, reducing response times and improving customer satisfaction.
              </p>
            </div>

            {/* Analytics & Insights */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaChartBar className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Analytics & Insights</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Comprehensive analytics dashboards that transform raw data into actionable insights, helping you understand your business performance at a glance.
              </p>
            </div>

            {/* Customer Support */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaHeadset className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Customer Support</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Streamlined ticket management system that organizes customer inquiries, tracks resolution times, and ensures no request goes unanswered.
              </p>
            </div>

            {/* Security & Privacy */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaShieldAlt className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Security & Privacy</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Enterprise-grade security measures that protect your data and ensure compliance with industry standards, giving you peace of mind.
              </p>
            </div>

            {/* Innovation */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaLightbulb className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Continuous Innovation</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                We're constantly evolving our platform with new features and improvements based on user feedback and emerging technologies.
              </p>
            </div>

            {/* Scalability */}
            <div className="bg-opsly-card rounded-xl p-6 sm:p-8 border border-gray-700 hover:border-opsly-purple transition">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-opsly-purple rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <FaRocket className="text-white text-xl sm:text-2xl" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3 sm:mb-4">Scalability</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Built to grow with your business. Our platform scales seamlessly from startups to enterprise-level operations.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-12 sm:mb-16 md:mb-20">
          <div className="bg-gradient-to-br from-opsly-purple/20 to-purple-900/20 rounded-xl p-6 sm:p-8 md:p-10 border border-opsly-purple/30">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6 sm:mb-8">
              Why Choose Öpsly?
            </h2>
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-opsly-purple rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-base sm:text-lg text-white font-semibold mb-2">Comprehensive Solutions</p>
                  <p className="text-sm sm:text-base text-gray-300">All-in-one platform that integrates customer support, analytics, and automation in a single, easy-to-use interface.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-opsly-purple rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-base sm:text-lg text-white font-semibold mb-2">User-Friendly Design</p>
                  <p className="text-sm sm:text-base text-gray-300">Intuitive interface that requires minimal training, allowing your team to become productive quickly.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-opsly-purple rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-base sm:text-lg text-white font-semibold mb-2">Customizable & Flexible</p>
                  <p className="text-sm sm:text-base text-gray-300">Tailor the platform to your specific business needs with customizable workflows and integrations.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-opsly-purple rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-base sm:text-lg text-white font-semibold mb-2">Dedicated Support</p>
                  <p className="text-sm sm:text-base text-gray-300">Our team is here to help you succeed with responsive customer support and comprehensive documentation.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-base sm:text-lg text-gray-300 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Join thousands of businesses that trust Öpsly to power their operations and drive growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/signup" 
              className="px-8 py-4 bg-gradient-to-r from-opsly-purple to-purple-600 text-white rounded-lg text-lg font-semibold hover:opacity-90 transition whitespace-nowrap"
            >
              Get Started
            </Link>
            <Link 
              to="/chat" 
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg text-lg font-semibold hover:bg-white hover:text-opsly-dark transition whitespace-nowrap flex items-center gap-2"
            >
              <HiChat className="text-xl" />
              <span>Contact Us</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AboutUs

