/**
 * 生成随机中文名字
 */
export function generateChineseName(): string {
  // 常见的姓氏
  const surnames = [
    '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
    '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
    '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
    '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
    '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎'
  ];

  // 常见的名字字
  const givenNames = [
    '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军',
    '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞',
    '平', '刚', '桂英', '玉兰', '萍', '鹏', '华', '红', '鑫', '林',
    '建国', '志强', '建华', '国强', '国庆', '爱华', '建', '明', '丽', '静',
    '雨欣', '子涵', '欣怡', '梓涵', '诗涵', '佳怡', '雨桐', '一诺', '语嫣',
    '浩宇', '浩然', '博文', '子轩', '皓轩', '宇轩', '欣', '子萱', '梓萱'
  ];

  // 随机选择姓氏
  const surname = surnames[Math.floor(Math.random() * surnames.length)];

  // 随机选择名字（1-2个字）
  const givenNameLength = Math.random() > 0.5 ? 2 : 1;
  let givenName = '';

  if (givenNameLength === 2) {
    // 选择双字名
    const twoCharNames = givenNames.filter(n => n.length === 2);
    givenName = twoCharNames[Math.floor(Math.random() * twoCharNames.length)];
  } else {
    // 选择单字名
    const oneCharNames = givenNames.filter(n => n.length === 1);
    givenName = oneCharNames[Math.floor(Math.random() * oneCharNames.length)];
  }

  return surname + givenName;
}

/**
 * 生成带序号的中文用户名
 * @param index 用户序号
 * @returns 中文用户名（如：张伟1, 李芳2）
 */
export function generateChineseNameWithIndex(index: number): string {
  const baseName = generateChineseName();
  return `${baseName}${index}`;
}
