import { userManager } from '@/storage/database';
import { generateRandomPassword } from '@/lib/random';
import { generateChineseNameWithIndex } from '@/lib/chineseName';

/**
 * 生成一个新访客账号（自注册用）。
 *
 * 两个要点：
 * 1. 每次调用都新建账号。早期版本用一个模块级变量缓存「默认用户」，
 *    导致第二次自注册会返回同一个账号，属于真实缺陷，这里已去掉。
 * 2. 数据库只保存密码散列，因此这里把刚生成的明文密码**原样随返回值给出一次**，
 *    供前端在注册结果里展示给用户自行保存；此后服务端不再持有明文。
 */
export async function generateDefaultUser() {
  // 获取下一个可用的用户序号
  const nextUserIndex = await userManager.getNextAiUserIndex();

  // 生成中文用户名（格式：张伟1, 李芳2...）
  const username = generateChineseNameWithIndex(nextUserIndex);

  // 生成随机密码（6-12字符）
  const password = generateRandomPassword(Math.floor(Math.random() * 7) + 6);

  // 创建用户（入库自动散列化）
  const user = await userManager.createUser({
    username,
    password,
  });

  // 返回值里的 password 是「一次性明文」，并非库中存储的值
  return { ...user, password };
}
