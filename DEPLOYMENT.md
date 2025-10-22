# 🚀 Hockey Goal Announcer - Deployment Guide

## Vercel Serverless Deployment (Recommended)

### ✅ **Why Vercel is Perfect for This App:**

- **Static Hosting**: Fast, global CDN for your web app
- **Serverless Functions**: High-quality TTS without server management
- **Free Tier**: Generous limits for personal/small projects
- **Easy Deployment**: Git-based deployment with automatic updates
- **Global Performance**: Fast loading worldwide

### 📋 **Deployment Steps:**

#### **1. Prepare Your Repository**
```bash
# Ensure all files are committed
git add .
git commit -m "Add Vercel serverless TTS support"
git push origin main
```

#### **2. Deploy to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: hockey-goal-announcer
# - Directory: ./
# - Override settings? No
```

#### **3. Configure Environment Variables**
In your Vercel dashboard, add these environment variables:

**For VoiceRSS (Free):**
```
VOICERSS_API_KEY=your_voice_rss_api_key
```

**For Google Cloud TTS (Premium):**
```
GOOGLE_CLOUD_CREDENTIALS={"type":"service_account","project_id":"..."}
```

#### **4. Test Your Deployment**
1. Visit your deployed URL
2. Select "Vercel Serverless TTS" mode
3. Test with "Test Voice" button
4. Record a goal and listen to the announcement

## 🏗️ **Architecture Overview:**

### **Frontend (Static)**
- HTML/CSS/JavaScript files served from Vercel CDN
- Fast loading, works offline for basic functionality
- Mobile-responsive design

### **Backend (Serverless)**
- `/api/tts.js` - VoiceRSS TTS function
- `/api/google-tts.js` - Google Cloud TTS function
- Functions run on-demand, scale automatically
- No server management required

## 💰 **Cost Breakdown:**

### **Free Tier (VoiceRSS)**
- ✅ **Vercel Hosting**: Free (100GB bandwidth/month)
- ✅ **VoiceRSS API**: Free (350 requests/day)
- ✅ **Total Cost**: $0/month

### **Premium Tier (Google Cloud)**
- ✅ **Vercel Hosting**: Free (100GB bandwidth/month)
- 💰 **Google Cloud TTS**: $4/1M characters (~$0.10/announcement)
- 💰 **Estimated Cost**: $1-5/month for active use

## 🔧 **Alternative Deployment Options:**

### **1. Netlify**
```bash
# Similar to Vercel, supports serverless functions
netlify deploy --prod
```

### **2. GitHub Pages (Static Only)**
- Free hosting for static files
- No serverless functions (browser TTS only)
- Good for demo/testing

### **3. AWS Amplify**
- Full-stack deployment
- Serverless functions support
- More complex setup

## 🎯 **Performance Comparison:**

| Platform | Setup | Cost | TTS Quality | Global Speed |
|----------|-------|------|-------------|--------------|
| **Vercel** | ⭐⭐⭐⭐⭐ | Free/Premium | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Local Server** | ⭐⭐ | Free | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **GitHub Pages** | ⭐⭐⭐⭐⭐ | Free | ⭐⭐ | ⭐⭐⭐⭐ |

## 🚨 **Troubleshooting:**

### **Common Issues:**

#### **TTS Function Not Working**
```bash
# Check function logs
vercel logs

# Test function directly
curl -X POST https://your-app.vercel.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Test announcement"}'
```

#### **CORS Issues**
- Functions include CORS headers
- Check browser console for errors
- Ensure functions are deployed correctly

#### **API Key Issues**
- Verify environment variables in Vercel dashboard
- Check API key permissions
- Test with demo keys first

## 📈 **Scaling Considerations:**

### **Traffic Limits:**
- **Vercel Free**: 100GB bandwidth/month
- **VoiceRSS Free**: 350 requests/day
- **Google Cloud**: Pay-per-use scaling

### **Upgrade Path:**
1. **Start**: Free tier with VoiceRSS
2. **Scale**: Add Google Cloud TTS for premium quality
3. **Custom**: Add custom voice models or recordings

## 🎉 **Success Metrics:**

After deployment, you should have:
- ✅ Fast-loading web app (under 2 seconds)
- ✅ High-quality TTS announcements
- ✅ Mobile-responsive design
- ✅ Offline functionality for basic features
- ✅ Automatic scaling with traffic

## 🔗 **Useful Links:**

- [Vercel Documentation](https://vercel.com/docs)
- [VoiceRSS API](https://www.voicerss.org/api/)
- [Google Cloud TTS](https://cloud.google.com/text-to-speech)
- [Your Deployed App](https://your-app.vercel.app) (replace with your URL)
