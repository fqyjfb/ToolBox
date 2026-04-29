import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Settings, Users, Wrench, Shield, Database } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full p-6">
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
        <div className="admin-card admin-card-small" onClick={() => {}}>
          <div className="icon-wrapper">
            <Shield className="w-8 h-8" />
          </div>
          <p className="card-title">安全设置</p>
          <p className="card-description">配置安全选项</p>
        </div>
        <div className="admin-card admin-card-small" onClick={() => {}}>
          <div className="icon-wrapper">
            <Settings className="w-8 h-8" />
          </div>
          <p className="card-title">系统设置</p>
          <p className="card-description">系统参数配置</p>
        </div>
        <div className="admin-card admin-card-wide" onClick={() => navigate('/admin/database')}>
          <div className="icon-wrapper">
            <Database className="w-8 h-8" />
          </div>
          <p className="card-title">数据管理</p>
          <p className="card-description">数据库备份与恢复</p>
        </div>
      </div>

      <style>{`
        .admin-cards {
          display: grid;
          grid-template-columns: repeat(2, 140px);
          grid-template-rows: repeat(3, 100px);
          grid-template-areas: 
            "b a"
            "c a"
            "d e";
          gap: 15px;
          padding: 24px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .admin-card-large {
          grid-area: a;
          background: linear-gradient(135deg, #dda36c 0%, #d4955a 100%);
        }

        .admin-card-small:nth-child(2) {
          grid-area: b;
          background-color: #67aaf7;
        }

        .admin-card-small:nth-child(3) {
          grid-area: c;
          background-color: #bc8acf;
        }

        .admin-card-small:nth-child(4) {
          grid-area: d;
          background-color: #f5a623;
        }

        .admin-card-small:nth-child(5) {
          grid-area: e;
          background-color: #00bcd4;
        }

        .admin-card-wide {
          grid-column: span 2;
          background-color: #e91e63;
        }

        .admin-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 300ms ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
        }

        .admin-card .icon-wrapper {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .admin-card .card-title {
          font-size: 1em;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .admin-card .card-description {
          font-size: 0.7em;
          opacity: 0.9;
          text-align: center;
        }

        .admin-card:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        @media (max-width: 640px) {
          .admin-cards {
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(4, 90px);
            grid-template-areas: 
              "a a"
              "b c"
              "d e"
              "f f";
            padding: 16px;
          }

          .admin-card-wide {
            grid-area: f;
          }

          .admin-card {
            padding: 12px;
          }

          .admin-card .icon-wrapper {
            width: 30px;
            height: 30px;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboardPage;
