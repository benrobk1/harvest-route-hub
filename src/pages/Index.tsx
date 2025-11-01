import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Users, TrendingUp, Truck, Leaf, Search, Sprout } from "lucide-react";
import logo from "@/assets/blue-harvests-logo.jpeg";

const Index = () => {
  const navigate = useNavigate();

  const consumerOption = {
    id: "consumer",
    title: "Shop from Farmers",
    description: "Access locally grown, organic produce delivered fresh to your door",
    route: "/auth/consumer",
  };

  const partnerOptions = [
    {
      id: "driver",
      title: "Earn as a Driver",
      description: "Join our delivery network and earn 100% of delivery fees plus tips",
      icon: Truck,
      color: "secondary",
      route: "/auth/driver",
    },
    {
      id: "farmer",
      title: "Sell Your Harvest",
      description: "Keep 90% of your sales and connect directly with local customers",
      icon: Sprout,
      color: "earth",
      route: "/auth/farmer",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-earth">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
          <img 
            src={logo} 
            alt="Blue Harvests" 
            className="h-32 mb-6 rounded-lg shadow-lg"
          />
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-foreground">
            Fresh from Local Farms to Your Door
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-6">
            Supporting farmers, feeding communities, delivering fresh
          </p>
          <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground mb-8">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold text-lg">90%</span>
              <span>to Farmers</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold text-lg">100%</span>
              <span>Fees to Drivers</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold text-lg">Fresh</span>
              <span>from Local Farms</span>
            </div>
          </div>
        </div>

        {/* Consumer Section */}
        <Card className="p-8 hover:shadow-lift transition-all border-2 border-primary/20">
          <div className="flex items-center mb-4">
            <Users className="h-10 w-10 text-primary mr-3" />
            <h2 className="text-3xl font-bold">{consumerOption.title}</h2>
          </div>
          <p className="text-muted-foreground text-lg mb-6">{consumerOption.description}</p>
          <Button 
            size="lg"
            onClick={() => navigate(consumerOption.route)}
            className="w-full text-lg h-14"
          >
            Start Shopping →
          </Button>
        </Card>

        {/* Partner Options Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">Join Our Community</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {partnerOptions.map((option) => (
              <Card key={option.id} className="p-6 hover:shadow-lift transition-all">
                <div className="flex items-center mb-4">
                  <option.icon className="h-8 w-8 text-primary mr-3" />
                  <h3 className="text-2xl font-bold">{option.title}</h3>
                </div>
                <p className="text-muted-foreground mb-4">{option.description}</p>
                <Button 
                  variant="outline"
                  onClick={() => navigate(option.route)}
                  className="w-full"
                >
                  Learn More →
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works Section */}
        <div className="col-span-1 md:col-span-3 mt-12">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Browse Local Farms</h3>
              <p className="text-muted-foreground">
                Discover fresh produce from farmers in your area
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Place Your Order</h3>
              <p className="text-muted-foreground">
                Add items to your cart and checkout securely
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Delivered Fresh</h3>
              <p className="text-muted-foreground">
                Get farm-fresh produce delivered to your door
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card className="p-8 bg-primary text-primary-foreground">
          <h2 className="text-3xl font-bold mb-6 text-center">Why Blue Harvests?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4" />
              <h3 className="font-semibold text-xl mb-2">90% to Farmers</h3>
              <p className="opacity-90">
                Your money goes directly to those who grow your food
              </p>
            </div>
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4" />
              <h3 className="font-semibold text-xl mb-2">Support Local</h3>
              <p className="opacity-90">
                Build connections with farmers in your community
              </p>
            </div>
            <div className="text-center">
              <Leaf className="h-12 w-12 mx-auto mb-4" />
              <h3 className="font-semibold text-xl mb-2">Fresh & Sustainable</h3>
              <p className="opacity-90">
                Reduce food miles and environmental impact
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Testimonials Section */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-12">What Our Community Says</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6">
            <p className="text-muted-foreground mb-4 italic">
              "Blue Harvests has completely changed how I sell my produce. I'm earning 90% on every sale instead of wholesale prices. It's sustainable for my family farm."
            </p>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Sarah M.</p>
                <p className="text-sm text-muted-foreground">Local Farmer</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <p className="text-muted-foreground mb-4 italic">
              "The freshness is unbeatable! I love knowing exactly where my food comes from and supporting farmers in my area. The delivery is always on time."
            </p>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Michael R.</p>
                <p className="text-sm text-muted-foreground">Happy Customer</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-muted-foreground mb-4 italic">
              "I love being part of this community and getting 100% of the delivery fees. The optimized routes make my deliveries efficient and the app is easy to use."
            </p>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">James L.</p>
                <p className="text-sm text-muted-foreground">Delivery Driver</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-primary py-12 px-4 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-6">
            <h3 className="mb-2 text-2xl font-bold">Blue Harvests</h3>
            <p className="text-white/70 text-sm">
              Family Farm Fresh • Locally Traceable • Climate Friendly
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/auth/admin")}
              className="text-white/50 hover:text-white/70 text-xs"
            >
              Staff Portal
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
