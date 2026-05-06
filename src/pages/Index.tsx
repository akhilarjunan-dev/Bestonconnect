import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header, Footer } from "@/components/layout/Layout";
import { 
  TrendingUp, 
  Shield, 
  DollarSign, 
  Users, 
  ArrowRight,
  CheckCircle2,
  Target,
  Clock,
  Star
} from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Transparent Earnings",
    description: "Every rupee you earn is clearly explained. Product commission × your tier rate + referral bonus. No hidden fees.",
  },
  {
    icon: TrendingUp,
    title: "Daily Sales Tiers",
    description: "Earn higher commission percentages as you sell more in a day. The more you sell, the higher your tier rate climbs.",
  },
  {
    icon: Users,
    title: "Referral Commission",
    description: "Earn extra when promoters you refer make sales or pay subscription fees. Build your team and grow passive income.",
  },
  {
    icon: Target,
    title: "Auto-Approved Commission",
    description: "Commissions are approved automatically after the return window — no manual review delays. Get paid faster.",
  },
  {
    icon: Shield,
    title: "Fair & Secure",
    description: "Robust tracking protects you and buyers. All earnings are auditable with full formula breakdown per transaction.",
  },
  {
    icon: Clock,
    title: "Fast Withdrawals",
    description: "Premium promoters can withdraw anytime with no minimum threshold. Free tier withdrawals processed weekly.",
  },
];

const stats = [
  { value: "₹25L+", label: "Paid to Promoters" },
  { value: "5,000+", label: "Active Promoters" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "24h", label: "Avg. Payout Time" },
];

const testimonials = [
  {
    name: "Arjun Sharma",
    role: "Premium Promoter",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    content: "The tier system is incredible — I hit the top tier by afternoon and earned 30% commission on all my evening sales. The transparency is unmatched!",
    earnings: "₹42,000/mo",
  },
  {
    name: "Priya Verma",
    role: "Top Promoter",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    content: "I refer products I actually use and my referral network earns me passive income. The daily tier reset keeps me motivated every single day.",
    earnings: "₹68,000/mo",
  },
  {
    name: "Ravi Kumar",
    role: "Rising Star",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    content: "Started 2 months ago as a free tier promoter. My daily sales hit the highest tier now consistently. The progression feels very rewarding!",
    earnings: "₹21,000/mo",
  },
];

const tiers = [
  {
    name: "Free Promoter",
    price: "Free",
    features: [
      "1 product referral link",
      "1 video ad upload",
      "Up to 30% commission rate",
      "1-month commission validity",
      "Daily tier progression",
      "Referral network earnings",
      "Weekly withdrawals",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Premium Promoter",
    price: "₹999/mo",
    features: [
      "Unlimited referral links",
      "Unlimited video ad uploads",
      "Up to 30% commission rate",
      "Commission valid for subscription period",
      "Daily tier progression",
      "Referral network earnings",
      "Withdraw anytime — no minimum",
      "Priority support & analytics",
    ],
    cta: "Go Premium",
    popular: true,
  },
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-surge/5" />
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-surge/10 rounded-full blur-3xl" />
          
          <div className="container relative py-20 md:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <Badge variant="premium" className="px-4 py-1.5">
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                Tier-Based Earnings System
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-display tracking-tight">
                Promote.{" "}
                <span className="text-gradient-hero">Earn.</span>
                <br />
                <span className="text-gradient-earnings">Thrive.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Join our transparent, tier-based promoter platform. 
                Sell more daily to unlock higher commission tiers — plus earn from your referral network.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/promoter/apply">
                  <Button variant="hero" size="xl" className="gap-2">
                    Become a Promoter
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/products">
                  <Button variant="outline" size="xl">
                    Browse Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-secondary">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div 
                  key={stat.label} 
                  className="text-center animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <p className="text-3xl md:text-4xl font-bold font-display text-secondary-foreground">
                    {stat.value}
                  </p>
                  <p className="text-sm text-secondary-foreground/70 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge variant="outline" className="mb-4">How It Works</Badge>
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Earnings That Make Sense
              </h2>
              <p className="text-muted-foreground">
                Our tier-based formula rewards consistent sellers — the more you sell daily, the higher your commission rate climbs.
              </p>
            </div>

            {/* Formula Display */}
            <Card variant="glass" className="max-w-3xl mx-auto mb-16 overflow-hidden">
              <CardContent className="p-8">
                <div className="text-center space-y-6">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Your Commission Formula
                  </p>
                  <div className="font-mono text-lg md:text-xl text-foreground bg-muted/50 rounded-xl p-6">
                    <span className="text-primary">Earnings</span> = 
                    <span className="text-earnings"> Price × Daily Tier Rate</span> + 
                    <span className="text-info"> Referral Network Bonus</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <p className="font-semibold text-primary">Product Commission</p>
                      <p className="text-muted-foreground text-xs">Set % per product you promote</p>
                    </div>
                    <div className="p-3 rounded-lg bg-earnings/10">
                      <p className="font-semibold text-earnings">Daily Tier Rate</p>
                      <p className="text-muted-foreground text-xs">More sales today = higher % tier</p>
                    </div>
                    <div className="p-3 rounded-lg bg-info/10">
                      <p className="font-semibold text-info">Referral Bonus</p>
                      <p className="text-muted-foreground text-xs">Earn from your referred promoters</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {features.map((feature, index) => (
                <Card 
                  key={feature.title} 
                  variant="interactive"
                  className="p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl gradient-hero shrink-0">
                      <feature.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold font-display text-foreground mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge variant="outline" className="mb-4">Success Stories</Badge>
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Promoters Love Us
              </h2>
              <p className="text-muted-foreground">
                Real earnings from real promoters on our platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
              {testimonials.map((testimonial, index) => (
                <Card key={testimonial.name} variant="glass" className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                    <Badge variant="earnings" className="ml-auto">
                      {testimonial.earnings}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-1 mt-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Tiers */}
        <section className="py-20">
          <div className="container">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge variant="outline" className="mb-4">Promoter Tiers</Badge>
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Choose Your Path
              </h2>
              <p className="text-muted-foreground">
                Start free or go premium for maximum earning potential.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {tiers.map((tier) => (
                <Card 
                  key={tier.name} 
                  variant={tier.popular ? "surge" : "default"}
                  className="relative overflow-hidden"
                >
                  {tier.popular && (
                    <div className="absolute top-0 right-0">
                      <Badge variant="premium" className="rounded-none rounded-bl-lg">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-8">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold font-display mb-2">{tier.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold font-display">{tier.price}</span>
                        {tier.price !== "Free" && (
                          <span className="text-muted-foreground">/month</span>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-5 h-5 text-earnings shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      variant={tier.popular ? "hero" : "outline"} 
                      className="w-full"
                      size="lg"
                    >
                      {tier.cta}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 gradient-hero">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold font-display text-primary-foreground">
                Ready to Start Earning?
              </h2>
              <p className="text-lg text-primary-foreground/80">
                Join thousands of promoters who trust our transparent, fair earning system.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/promoter/apply">
                  <Button variant="glass" size="xl" className="gap-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-white/20">
                    Apply Now
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/promoter/dashboard">
                  <Button variant="glass" size="xl" className="bg-white/10 hover:bg-white/20 text-primary-foreground border-white/10">
                    View Demo Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
