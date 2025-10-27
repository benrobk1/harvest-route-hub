import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Users, Truck, Sprout, BarChart3 } from "lucide-react";
import logo from "@/assets/blue-harvests-logo.jpeg";

const Index = () => {
  const navigate = useNavigate();

  const mainStakeholders = [
    {
      id: "consumer",
      title: "Shop Farm Fresh",
      description: "Access locally grown, organic produce delivered fresh to your door",
      icon: Users,
      color: "primary",
      route: "/auth/consumer",
    },
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
      <header className="relative overflow-hidden bg-gradient-hero py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Blue Harvests Logo" className="h-32 md:h-40 object-contain" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="text-white/90 text-sm">90% to Farmers • 100% of Fees to Drivers</div>
          </div>
        </div>
      </header>

      {/* Stakeholder Selection */}
      <section className="container mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
          Get Started
        </h2>
        
        <div className="grid gap-6 md:grid-cols-3">
          {mainStakeholders.map((stakeholder) => {
            const Icon = stakeholder.icon;
            return (
              <Card
                key={stakeholder.id}
                className="group relative overflow-hidden border-2 hover:border-primary transition-all duration-300 hover:shadow-large cursor-pointer"
                onClick={() => navigate(stakeholder.route)}
              >
                <div className="p-6 space-y-4">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-${stakeholder.color}/10 text-${stakeholder.color} transition-transform group-hover:scale-110`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {stakeholder.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {stakeholder.description}
                    </p>
                  </div>

                  <Button
                    className="w-full group-hover:shadow-medium transition-shadow"
                    variant={stakeholder.color === "primary" ? "default" : "outline"}
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Value Proposition */}
      <section className="bg-white py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-3 text-center">
            <div>
              <div className="mb-4 text-4xl font-bold text-primary">90%</div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Direct to Farmers</h3>
              <p className="text-sm text-muted-foreground">
                Farmers keep 90% of product prices, far above wholesale rates
              </p>
            </div>
            <div>
              <div className="mb-4 text-4xl font-bold text-secondary">100%</div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Driver Earnings</h3>
              <p className="text-sm text-muted-foreground">
                Delivery drivers receive 100% of delivery fees plus customer tips
              </p>
            </div>
            <div>
              <div className="mb-4 text-4xl font-bold text-earth">$25</div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Minimum Order</h3>
              <p className="text-sm text-muted-foreground">
                Low minimum with $10 credit when you spend $100+ monthly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-12 px-4 text-white">
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
              <BarChart3 className="h-3 w-3 mr-1" />
              Staff Portal
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
