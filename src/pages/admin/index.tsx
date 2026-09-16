import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Users, Wrench, Database } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="admin-cards">
        <div className="admin-card admin-card-large" onClick={() => navigate('/admin/websites')}>
          <div className="icon-wrapper">
            <Globe className="w-8 h-8" />
          </div>
          <p className="card-title">网址管理</p>
          <p className="card-description">管理网站导航链接</p>
        </div>
        <div className="admin-card admin-card-small" onClick={() => navigate('/admin/users')}>
          <div className="icon-wrapper">
            <Users className="w-8 h-8" />
          </div>
          <p className="card-title">用户管理</p>
          <p className="card-description">管理系统用户</p>
        </div>
        <div className="admin-card admin-card-small" onClick={() => navigate('/admin/tools')}>
          <div className="icon-wrapper">
            <Wrench className="w-8 h-8" />
          </div>
          <p className="card-title">工具管理</p>
          <p className="card-description">管理下载工具</p>
        </div>
        <div className="admin-card admin-card-wide" onClick={() => navigate('/admin/database')}>
          <div className="icon-wrapper">
            <Database className="w-8 h-8" />
          </div>
          <p className="card-title">数据管理</p>
          <p className="card-description">数据库备份与恢复</p>
        </div>
      </div>


    </div>
  );
};

export default AdminDashboardPage;
