'use client';

import { useState, useMemo } from 'react';
import {
  Calculator,
  FileText,
  Building2,
  Users,
  DollarSign,
  Calendar,
  Download,
  Info,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// 年费区间数据（单位：元/年）
const ANNUAL_FEE_RANGES = {
  invention: [
    { startYear: 1, endYear: 3, fee: 900 },
    { startYear: 4, endYear: 6, fee: 1200 },
    { startYear: 7, endYear: 9, fee: 2000 },
    { startYear: 10, endYear: 12, fee: 4000 },
    { startYear: 13, endYear: 15, fee: 6000 },
    { startYear: 16, endYear: 20, fee: 8000 },
  ],
  utilityModel: [
    { startYear: 1, endYear: 3, fee: 600 },
    { startYear: 4, endYear: 5, fee: 900 },
    { startYear: 6, endYear: 8, fee: 1200 },
    { startYear: 9, endYear: 10, fee: 2000 },
  ],
  design: [
    { startYear: 1, endYear: 3, fee: 600 },
    { startYear: 4, endYear: 5, fee: 900 },
    { startYear: 6, endYear: 8, fee: 1200 },
    { startYear: 9, endYear: 10, fee: 2000 },
    { startYear: 11, endYear: 12, fee: 4000 },
    { startYear: 13, endYear: 15, fee: 6000 },
  ],
};

// 一次性费用（单位：元）
const ONE_TIME_FEES = {
  application: {
    invention: 900,
    utilityModel: 500,
    design: 500,
  },
  examination: {
    invention: 2500,
  },
  registration: {
    invention: 255,
    utilityModel: 205,
    design: 205,
  },
};

type PatentType = 'invention' | 'utilityModel' | 'design';
type EntityType = 'individual' | 'microEnterprise' | 'enterprise' | 'institution';

interface FeeCalculation {
  applicationFee: number;
  examinationFee: number;
  registrationFee: number;
  annualFees: number[];
  annualFeeTotal: number;
  total: number;
}

export default function FeeCalculatorPage() {
  const [patentType, setPatentType] = useState<PatentType>('invention');
  const [entityType, setEntityType] = useState<EntityType>('individual');

  // 计算费用减缴比例
  const reductionRate = useMemo(() => {
    if (entityType === 'individual' || entityType === 'microEnterprise') {
      return 0.85; // 85%减缴，缴纳15%
    } else if (entityType === 'institution') {
      return 0.70; // 70%减缴，缴纳30%
    }
    return 0; // 大中型企业不减缴，缴纳100%
  }, [entityType]);

  // 计算最终费用（原价 × (1 - 减缴比例)）
  const calculateFinalFee = (baseFee: number) => {
    return Math.floor(baseFee * (1 - reductionRate));
  };

  // 计算各项费用
  const calculateFees = useMemo(() => {
    const maxYears = patentType === 'invention' ? 20 : patentType === 'utilityModel' ? 10 : 15;
    const feeRanges = ANNUAL_FEE_RANGES[patentType];

    // 计算每年的年费
    const annualFees: number[] = [];
    for (let year = 1; year <= maxYears; year++) {
      const range = feeRanges.find(
        (r) => year >= r.startYear && year <= r.endYear
      );
      const baseFee = range?.fee || 0;
      const finalFee = calculateFinalFee(baseFee);
      annualFees.push(finalFee);
    }

    // 一次性费用
    const applicationFee = calculateFinalFee(ONE_TIME_FEES.application[patentType]);
    const examinationFee = patentType === 'invention' 
      ? calculateFinalFee(ONE_TIME_FEES.examination.invention) 
      : 0;
    const registrationFee = calculateFinalFee(ONE_TIME_FEES.registration[patentType]);

    // 年费总计
    const annualFeeTotal = annualFees.reduce((sum, fee) => sum + fee, 0);

    // 总费用
    const total = applicationFee + examinationFee + registrationFee + annualFeeTotal;

    return {
      applicationFee,
      examinationFee,
      registrationFee,
      annualFees,
      annualFeeTotal,
      total,
    };
  }, [patentType, reductionRate]);

  // 导出报告
  const handleExport = () => {
    const report = `
专利费用计算报告
=================

基本信息
--------
专利类型: ${patentType === 'invention' ? '发明专利' : patentType === 'utilityModel' ? '实用新型' : '外观设计'}
申请主体: ${entityType === 'individual' ? '个人' : entityType === 'microEnterprise' ? '小微企业' : entityType === 'enterprise' ? '大中型企业' : '事业单位/科研机构'}
费用减缴: ${reductionRate > 0 ? `减缴${(reductionRate * 100).toFixed(0)}%，缴纳${((1 - reductionRate) * 100).toFixed(0)}%` : '不减缴，缴纳100%'}

费用明细（一次性费用）
--------------------
申请费: ¥${calculateFees.applicationFee}
${patentType === 'invention' ? `实质审查费: ¥${calculateFees.examinationFee}` : ''}
登记印刷费: ¥${calculateFees.registrationFee}

年费明细 (${calculateFees.annualFees.length}年)
--------------------------
${calculateFees.annualFees.map((fee, i) => `第${i + 1}年: ¥${fee}`).join('\n')}

费用汇总
--------
年费总计: ¥${calculateFees.annualFeeTotal}
一次性费用: ¥${calculateFees.applicationFee + calculateFees.examinationFee + calculateFees.registrationFee}

总计: ¥${calculateFees.total}

生成时间: ${new Date().toLocaleString('zh-CN')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `专利费用计算报告_${new Date().toLocaleDateString('zh-CN')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const patentTypeLabels = {
    invention: '发明专利',
    utilityModel: '实用新型',
    design: '外观设计',
  };

  const entityTypeLabels = {
    individual: '个人',
    microEnterprise: '小微企业',
    enterprise: '大中型企业',
    institution: '事业单位/科研机构',
  };

  const protectionPeriod = {
    invention: 20,
    utilityModel: 10,
    design: 15,
  };

  // 计算基础费用（原价）
  const baseFees = useMemo(() => {
    const maxYears = protectionPeriod[patentType];
    const feeRanges = ANNUAL_FEE_RANGES[patentType];
    
    const annualFees: number[] = [];
    for (let year = 1; year <= maxYears; year++) {
      const range = feeRanges.find(
        (r) => year >= r.startYear && year <= r.endYear
      );
      annualFees.push(range?.fee || 0);
    }

    return {
      applicationFee: ONE_TIME_FEES.application[patentType],
      examinationFee: patentType === 'invention' ? ONE_TIME_FEES.examination.invention : 0,
      registrationFee: ONE_TIME_FEES.registration[patentType],
      annualFees,
      annualFeeTotal: annualFees.reduce((sum, fee) => sum + fee, 0),
      total: ONE_TIME_FEES.application[patentType] + 
            (patentType === 'invention' ? ONE_TIME_FEES.examination.invention : 0) +
            ONE_TIME_FEES.registration[patentType] +
            annualFees.reduce((sum, fee) => sum + fee, 0),
    };
  }, [patentType]);

  return (
    <div className="min-h-screen bg-background">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="page-title">
                专利费用计算器
              </h1>
              <p className="page-subtitle mt-1">
                精确计算专利全流程费用，支持费用减缴
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 左侧：参数配置 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="bg-muted">
                <CardTitle className="section-title flex items-center gap-2">
                  <Info className="size-5 text-brand" />
                  参数配置
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* 专利类型 */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">专利类型</Label>
                  <RadioGroup value={patentType} onValueChange={(v) => setPatentType(v as PatentType)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="invention" id="invention" />
                      <Label htmlFor="invention" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="size-4 text-brand" />
                        <span className="text-sm">发明专利</span>
                        <Badge variant="outline" className="text-xs">保护期20年</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="utilityModel" id="utilityModel" />
                      <Label htmlFor="utilityModel" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="size-4 text-brand" />
                        <span className="text-sm">实用新型</span>
                        <Badge variant="outline" className="text-xs">保护期10年</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="design" id="design" />
                      <Label htmlFor="design" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="size-4 text-brand" />
                        <span className="text-sm">外观设计</span>
                        <Badge variant="outline" className="text-xs">保护期15年</Badge>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 申请主体 */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">申请主体</Label>
                  <RadioGroup value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="individual" />
                      <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer">
                        <Users className="size-4 text-brand" />
                        <span className="text-sm">个人</span>
                        <Badge variant="success" className="text-xs">缴纳15%</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="microEnterprise" id="microEnterprise" />
                      <Label htmlFor="microEnterprise" className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="size-4 text-brand" />
                        <span className="text-sm">小微企业</span>
                        <Badge variant="success" className="text-xs">缴纳15%</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="enterprise" id="enterprise" />
                      <Label htmlFor="enterprise" className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="size-4 text-brand" />
                        <span className="text-sm">大中型企业</span>
                        <Badge variant="muted" className="text-xs">缴纳100%</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="institution" id="institution" />
                      <Label htmlFor="institution" className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="size-4 text-brand" />
                        <span className="text-sm">事业单位/科研机构</span>
                        <Badge variant="info" className="text-xs">缴纳30%</Badge>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 计算说明 */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Info className="size-4 text-brand" />
                    计算公式
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    最终费用 = 原价 × (1 - 减缴比例)
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">个人/小微企业：</span>
                      <span className="font-medium text-success">减缴85%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">事业单位/科研机构：</span>
                      <span className="font-medium text-info">减缴70%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">大中型企业：</span>
                      <span className="font-medium text-foreground">不减缴</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：费用展示 */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* 总费用卡片 */}
            <Card className="shadow-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-5 text-brand" />
                    <h3 className="lead-title">全流程总费用</h3>
                  </div>
                  {reductionRate > 0 && (
                    <Badge variant="success">
                      已减缴 {(reductionRate * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="stat-value tracking-tight text-foreground">
                    ¥{calculateFees.total.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {patentTypeLabels[patentType]} · {entityTypeLabels[entityType]} · 保护期{protectionPeriod[patentType]}年
                </p>
                {reductionRate > 0 && (
                  <div className="mt-3 p-3 bg-success-subtle rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">原价</span>
                      <span className="text-foreground tabular-nums">¥{baseFees.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">减缴金额</span>
                      <span className="text-success font-medium tabular-nums">-¥{(baseFees.total - calculateFees.total).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 费用明细和时间轴 */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="details">费用明细</TabsTrigger>
                <TabsTrigger value="timeline">年费明细（10年）</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <Card>
                  <CardHeader className="bg-muted">
                    <CardTitle className="section-title flex items-center gap-2">
                      <TrendingUp className="size-5 text-brand" />
                      费用明细清单
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {/* 一次性费用 */}
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="size-4 text-brand" />
                            <span className="text-sm font-semibold text-foreground">一次性费用</span>
                          </div>
                          
                          {/* 申请费 */}
                          <div className="flex items-center justify-between py-2 px-2">
                            <span className="text-sm text-muted-foreground">申请费</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-foreground tabular-nums">¥{calculateFees.applicationFee}</span>
                              {reductionRate > 0 && (
                                <div className="text-xs text-muted-foreground tabular-nums">原价¥{baseFees.applicationFee}</div>
                              )}
                            </div>
                          </div>

                          {/* 实质审查费 */}
                          {patentType === 'invention' && (
                            <div className="flex items-center justify-between py-2 px-2">
                              <span className="text-sm text-muted-foreground">实质审查费</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-foreground tabular-nums">¥{calculateFees.examinationFee}</span>
                                {reductionRate > 0 && (
                                  <div className="text-xs text-muted-foreground tabular-nums">原价¥{baseFees.examinationFee}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 登记印刷费 */}
                          <div className="flex items-center justify-between py-2 px-2">
                            <span className="text-sm text-muted-foreground">登记印刷费</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-foreground tabular-nums">¥{calculateFees.registrationFee}</span>
                              {reductionRate > 0 && (
                                <div className="text-xs text-muted-foreground tabular-nums">原价¥{baseFees.registrationFee}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 年费 */}
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-brand" />
                              <span className="text-sm font-semibold text-foreground">
                                年费总计（{protectionPeriod[patentType]}年）
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-foreground tabular-nums">¥{calculateFees.annualFeeTotal}</span>
                              {reductionRate > 0 && (
                                <div className="text-xs text-muted-foreground tabular-nums">原价¥{baseFees.annualFeeTotal}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 总计 */}
                        <div className="flex items-center justify-between p-4 bg-brand-subtle rounded-xl">
                          <div className="flex items-center gap-2">
                            <DollarSign className="size-5 text-brand" />
                            <span className="section-title">总计</span>
                          </div>
                          <span className="stat-value text-brand">
                            ¥{calculateFees.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline">
                <Card>
                  <CardHeader className="bg-muted">
                    <CardTitle className="section-title flex items-center gap-2">
                      <Calendar className="size-5 text-brand" />
                      年费明细（前10年）
                    </CardTitle>
                    <CardDescription className="text-xs">
                      显示前10年的年费明细，${patentType === 'invention' ? '发明专利保护期20年' : patentType === 'utilityModel' ? '实用新型保护期10年' : '外观设计保护期15年'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {calculateFees.annualFees.slice(0, 10).map((fee, index) => {
                          const year = index + 1;
                          const baseFee = baseFees.annualFees[index];
                          const isHighFee = fee > 1500;

                          return (
                            <div
                              key={year}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                isHighFee
                                  ? 'bg-warning-subtle'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isHighFee
                                    ? 'bg-warning-subtle text-warning-subtle-foreground'
                                    : 'bg-muted text-foreground'
                                }`}>
                                  {year}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-foreground">第{year}年</div>
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {isHighFee ? '高费率阶段' : '正常费率'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-base font-bold tabular-nums ${isHighFee ? 'text-warning' : 'text-foreground'}`}>
                                  ¥{fee}
                                </div>
                                {reductionRate > 0 && fee !== baseFee && (
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    原价¥{baseFee}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* 导出按钮 */}
            <Button onClick={handleExport} variant="default" className="w-full">
              <Download className="size-4 mr-2" />
              导出费用报告
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
