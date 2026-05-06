import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageCircle, Mail, Phone, Clock, Loader2, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Contact() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please sign in to contact support');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('support_messages')
      .insert({
        user_id: user.id,
        subject: `[${category.toUpperCase()}] ${subject}`,
        message: message,
        status: 'open'
      });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to send message. Please try again.');
      console.error(error);
    } else {
      setSubmitted(true);
      toast.success('Message sent! We\'ll get back to you soon.');
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div className="container py-12">
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="py-12 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Message Sent!</h2>
              <p className="text-muted-foreground">
                Thank you for contacting us. Our support team will review your message and get back to you within 24-48 hours.
              </p>
              <div className="pt-4 space-x-2">
                <Button onClick={() => {
                  setSubmitted(false);
                  setSubject('');
                  setMessage('');
                  setCategory('general');
                }} variant="outline">
                  Send Another Message
                </Button>
                <Link to="/">
                  <Button>Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display flex items-center justify-center gap-2">
            <MessageCircle className="h-8 w-8 text-primary" />
            Contact Customer Care
          </h1>
          <p className="text-muted-foreground">We're here to help! Send us a message and we'll respond as soon as possible.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Contact Info Cards */}
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <Mail className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold">Email</h3>
              <p className="text-sm text-muted-foreground">support@bestonconnect.com</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <Phone className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold">Phone</h3>
              <p className="text-sm text-muted-foreground">+91 1800-XXX-XXXX</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <Clock className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold">Hours</h3>
              <p className="text-sm text-muted-foreground">Mon-Sat: 9AM - 6PM IST</p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Send us a Message</CardTitle>
            <CardDescription>
              {user 
                ? "Fill out the form below and we'll get back to you."
                : "Please sign in to send a message to our support team."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="order">Order Issue</SelectItem>
                        <SelectItem value="payment">Payment Problem</SelectItem>
                        <SelectItem value="return">Returns & Refunds</SelectItem>
                        <SelectItem value="promoter">Promoter Support</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe your issue or question in detail..."
                    rows={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Message
                </Button>
              </form>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">Please sign in to contact support.</p>
                <Link to="/auth">
                  <Button>Sign In</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
