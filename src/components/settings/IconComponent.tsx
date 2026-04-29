import React from 'react';
import {
  Monitor, Bell, Settings, Trash2, Info, Circle, Home, Wrench, Zap, Bookmark,
  CheckCircle, Search, Flame, FileText, Calculator, Globe, Clipboard, MessageSquare, Download,
  Upload, Camera, Music, Image, Video, Clock, Shield, Heart, Star, User, Mail, Phone, Map,
  Layers, Palette, Gift, RefreshCw, Lock, Unlock, Wifi, Battery, Volume2, VolumeX, Maximize2,
  Minimize2, RotateCcw, Moon, Sun, Cpu, HardDrive, Smartphone, Printer, Cloud, CloudRain,
  CloudSun, CloudMoon, ZapOff, AlertCircle, AlertTriangle, XCircle, HelpCircle, Terminal, Code,
  GitBranch, ExternalLink, ChevronRight, ArrowRight, Key, Navigation, Newspaper, Languages,
  FileCode, Smile, Braces, ArrowUpDown, Hash, Copy, Table, Link, QrCode, AtSign, Tag, AlignLeft,
  Code2, Binary
} from 'lucide-react';

interface IconComponentProps {
  name: string;
  color?: string;
  size?: number;
}

const IconComponent: React.FC<IconComponentProps> = ({ name, color = '#333', size = 20 }) => {
  const iconProps = { size, style: { color } };
  
  const iconMap: Record<string, React.ComponentType<any>> = {
    Home, Wrench, Zap, Bookmark, CheckCircle, Search, Flame, Settings,
    FileText, Calculator, Globe, Clipboard, MessageSquare, Download, Upload, Camera,
    Music, Image, Video, Clock, Shield, Heart, Star, User, Mail, Phone, Map, Layers,
    Palette, Bell, Gift, RefreshCw, Trash2, Lock, Unlock, Wifi, Battery, Volume2,
    VolumeX, Maximize2, Minimize2, RotateCcw, Moon, Sun, Cpu, HardDrive, Monitor,
    Smartphone, Printer, Cloud, CloudRain, CloudSun, CloudMoon, ZapOff, AlertCircle,
    AlertTriangle, Info, XCircle, HelpCircle, Terminal, Code, GitBranch, ExternalLink,
    ChevronRight, ArrowRight, Circle, Key, Navigation, Newspaper, Languages, FileCode,
    Smile, Braces, ArrowUpDown, Hash, Copy, Table, Link, QrCode, AtSign, Tag, AlignLeft,
    Code2, Binary
  };
  
  const Icon = iconMap[name] || HelpCircle;
  return <Icon {...iconProps} />;
};

export default IconComponent;
