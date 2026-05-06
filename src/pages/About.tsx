import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Users, Shield, Zap, Heart, Globe } from 'lucide-react';

export default function About() {
  return (
    <Layout>
      <div className="container py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-12">
          <h1 className="text-4xl font-bold font-display">About <span className="text-gradient-hero">Bestonconnect</span></h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Empowering promoters and shoppers with a transparent, fair, and rewarding marketplace experience.
          </p>
        </div>

        {/* Mission Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              At Bestonconnect, we believe in creating opportunities for everyone. Our platform bridges the gap between 
              quality products and passionate promoters, enabling fair earnings while providing shoppers with authentic 
              recommendations and great deals. We're committed to transparency, trust, and building lasting relationships 
              with our community.
            </p>
          </CardContent>
        </Card>

        {/* Values Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Trust & Transparency</h3>
              <p className="text-sm text-muted-foreground">
                Clear commission structures, honest product information, and transparent business practices.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Community First</h3>
              <p className="text-sm text-muted-foreground">
                We grow together. Our success is tied to the success of our promoters and satisfaction of our shoppers.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Innovation</h3>
              <p className="text-sm text-muted-foreground">
                Continuously improving our platform to provide the best experience for everyone involved.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* What We Offer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              What We Offer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  For Shoppers
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Quality products at competitive prices</li>
                  <li>• Authentic reviews from real customers</li>
                  <li>• Secure payment options</li>
                  <li>• Easy returns and customer support</li>
                  <li>• Regular deals and discounts</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  For Promoters
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Fair and transparent commission structure</li>
                  <li>• Easy-to-use referral link system</li>
                  <li>• Real-time earnings tracking</li>
                  <li>• Flexible withdrawal options</li>
                  <li>• Growth opportunities and bonuses</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground">
              Have questions? Reach out to us at{' '}
              <a href="mailto:support@bestonconnect.com" className="text-primary hover:underline">
                support@bestonconnect.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
