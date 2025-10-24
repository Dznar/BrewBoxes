function Header() {
  return (
    <header className="container mx-auto px-4 py-8">
      <div className="text-center flex flex-col items-center justify-center">
        <div className="flex items-center justify-center mb-4">
          <img src="/icon.png" alt="BrewBoxes Logo" className="h-16 w-16 mr-4" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            BrewBoxes
          </h1>
        </div>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Experience the power of Linux distributions directly in your browser.
          Choose your favorite distro and desktop environment to get started instantly.
        </p>
      </div>
    </header>
  );
}

export default Header;
