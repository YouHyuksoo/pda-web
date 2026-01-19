/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // oracledb 네이티브 바이너리를 위해 외부 패키지로 처리
    serverComponentsExternalPackages: ['oracledb'],
  },
};

export default nextConfig;
