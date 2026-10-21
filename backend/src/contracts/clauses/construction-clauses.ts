/**
 * Static clauses of the CONSTRUCTION contract ("HĐ Thi công") — copied VERBATIM from the company
 * template `docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx` (extracted with
 * `textutil -convert txt` on 2026-10-22). Spelling, capitals and numbering are the template's own
 * (Article 4 numbers its items 5.1/5.2 in the original); only runs of spaces/tabs are collapsed.
 *
 * Plain text, not HTML: the template escapes every string. The parts the template fills per order
 * (parties, line table, value, installments, bank account, warranty list) are NOT here, and the
 * sample data of the original (names, products, amounts, numbers) was left out on purpose.
 */
export const CONSTRUCTION_CLAUSES = {
  motto: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc'],
  mottoRule: '---------------',
  title: 'HỢP ĐỒNG THI CÔNG',
  legalBases: [
    '- Căn cứ Luật thương mại nước Cộng hoà Xã hội Chủ nghĩa Việt Nam năm 2005 và các văn bản hướng dẫn thi hành;',
    '- Căn cứ Bộ Luật dân sự 91/2015/QH13 ngày 24/11/2015 của Quốc hội Nước CHXHCN Việt Nam;',
    '- Căn cứ chức năng, nhiệm vụ, quyền hạn, khả năng và nhu cầu của hai bên.',
  ],
  partyALabel: 'BÊN GIAO THẦU (BÊN A):',
  partyBLabel: 'BÊN NHẬN THẦU (BÊN B):',
  agreement:
    'Hai bên thỏa thuận ký kết Hợp đồng thi công với các nội dung sau:',
  article1Heading: 'ĐIỀU 1: NỘI DUNG HỢP ĐỒNG',
  article1Intro:
    'Bên A đồng ý giao cho Bên B thi công, lắp đặt trọn gói hệ thống điện mặt trời tại địa điểm:',
  article1Materials: 'Vật tư thi công gồm:',
  article2Heading: 'ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG',
  article2Value: '1. Giá trị hợp đồng:',
  article2Progress: [
    '2. Tiến độ thi công:',
    '- Thời gian thi công và bàn giao công trình 10 ngày kể từ khi Bên B nhận được tạm ứng của Bên A.',
  ],
  article3Heading: 'ĐIỀU 3: THANH TOÁN.',
  article3Method: '3.1. Phương thức thanh toán:',
  article3DossierHeading: 'Hồ sơ bao gồm:',
  article3Dossier: [
    'Biên bản nghiệm thu bàn giao công trình;',
    'Giấy đề nghị thanh toán;',
  ],
  article3Review:
    'Trong quá trình xem xét hồ sơ thanh toán nếu có yêu cầu giải trình, bổ sung hồ sơ chứng từ Bên B có trách nhiệm cung cấp cho Bên A, tuy nhiên việc bổ sung sẽ không làm chậm trễ việc thanh toán theo thời hạn mà hợp đồng đã quy định.',
  article3Info: '3.2. Thông tin thanh toán:',
  article4Heading: 'ĐIỀU 4: BÀN GIAO NGHIỆM THU, BẢO HÀNH.',
  article4: [
    '5.1. Bàn giao, Nghiệm thu Công trình.',
    'a) Sau khi hoàn thành Công trình, Bên B sẽ thông báo cho Bên A nghiệm thu Công trình. Trong vòng hai (2) ngày làm việc kể từ ngày nhận được thông báo của Bên B, Bên A phải cùng với Bên B tiến hành nghiệm thu bàn giao Công trình và ký Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng. Kể từ ngày thứ ba (3) trở đi, Bên B có quyền tính thêm chi phí cử người quản lý, trông coi Công trình, cũng như các chi phí hợp lý khác (nếu có).',
    'b) Quá ba (3) ngày làm việc kể từ ngày nhận được thông báo lần 2 của Bên B về việc nghiệm thu bàn giao mà Bên A vẫn chưa cùng Bên B nghiệm thu bàn giao thì Công trình được xem như đã được bên B hoàn thành theo đúng khối lượng, chất lượng và tiến độ theo đúng quy định của hợp đồng (“Công trình được xem hoàn thành”), Bên B có quyền rút người, máy móc thiết bị ra khỏi Công trình khi đó mọi rủi ro, mất mát, hư hỏng Công trình sẽ do bên A chịu trách nhiệm.',
    '5.2. Bảo hành Công Trình.',
    'a) Thời gian bảo hành Công trình là mười hai (12) tháng kể từ ngày ký Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng, chi phí di chuyển >50km, phát sinh bảo hành do 2 bên thỏa thuận kèm theo biên bản hoặc báo giá.',
    'b) Trong thời gian bảo hành Bên B có trách nhiệm sửa chữa kịp thời những hư hỏng do lỗi thi công của Bên B (Bên B không bảo hành trong trường hợp lỗi do thiết bị bên A cấp bị hư hỏng).',
  ],
  article5Heading: 'ĐIỀU 5: TRÁCH NHIỆM CỦA CÁC BÊN.',
  article5PartyA: [
    '1. Trách nhiệm của Bên A:',
    '- Cung cấp đảm bảo điện, nước đến công trình, tạm ứng và thanh toán kịp thời;',
    '- Cung cấp bản vẽ kỹ thuật công trình;',
    '- Cử người trực tiếp giám sát thi công về tiến độ, biện pháp kỹ thuật thi công',
    '- Thay mặt bên B (khi cần thiết) giải quyết các yêu cầu gấp rút trong quá trình thi công;',
    '- Nhận bàn giao Công trình và ký Biên bản nghiệm thu theo yêu cầu của Bên B.',
  ],
  article5PartyBBeforeGoods: [
    '2. Trách nhiệm của Bên B:',
    '- Cung cấp vật tư nhân lực, thiết bị để lắp đặt các hạng mục đúng yêu cầu kỹ thuật, thời gian và số lượng',
    '- Hàng hóa tập kế xuống công trình: Tấm pin và inverter phải đầy đủ CO, CQ (scan)',
  ],
  article5PartyBAfterGoods: [
    '- Thi công theo yêu cầu cụ thể của Bên A đảm bảo chất lượng, kỹ thuật, mỹ thuật của công trình.',
    '- Lập tiến độ thi công, biện pháp kỹ thuật an toàn và phải được sự nhất trí của bên A.',
    '- Đảm bảo thi công an toàn tuyệt đối cho người và công trình. Nếu có tai nạn xảy ra, bên B chịu hoàn toàn trách nhiệm bồi thường thiệt hại theo quy định của pháp luật;',
    '- Tự lo chỗ ăn, ở, sinh hoạt của công nhân, chấp hành các quy định về trật tư, an ninh, khai báo tạm trú;',
    '- Đảm bảo tuân thủ thực hiện các quy định về phòng cháy chữa cháy, an toàn và an ninh trật tự tại địa điểm thi công; Đảm bảo dụng cụ thi công tại công trường đúng tiêu chuẩn kỹ thuật, tránh dụng cụ thiết bị quá cũ không đảm bảo an toàn thi công; Đảm bảo trang bị bảo hộ lao động tại công trường phải đúng theo tiêu chuẩn an toàn lao động; Đảm bảo đúng quy trình, biện pháp thi công lắp đặt, đảm bảo an toàn, vệ sinh lao động.',
    '- Bên B không bảo hành các trường hợp pin, inverter, bình lưu trữ... bị hư hỏng không phải do lỗi của nhà sản xuất như: hệ thống bị sét đánh trực tiếp, thiên tai, hỏa hoạn… hoặc lỗi do người sử dụng tự ý tháo mở thiết bị gây nên.',
    '- Chịu trách nhiệm bảo hành công trình trong thời hạn 01 năm kể từ ngày được bên A nghiệm thu đưa vào sử dụng.',
  ],
  article6Heading: 'ĐIỀU 6: CHẤM DỨT HỢP ĐỒNG TRƯỚC THỜI HẠN.',
  article6: [
    'Hợp đồng thi công sẽ chấm dứt trước thời hạn trong các trường hợp sau:',
    '6.1. Theo thỏa thuận của hai bên.',
    '6.2. Một trong hai bên bị phá sản.',
    '6.3. Xảy ra sự kiện bất khả kháng theo Điều 7 của Hợp đồng.',
    '6.4. Nếu một bên vi phạm các nghĩa vụ trong hợp đồng và không khắc phục theo yêu cầu của Bên bị vi phạm thì Bên bị vi phạm được quyền đơn phương chấm dứt hợp đồng bằng cách thông báo cho bên vi phạm bằng văn bản trước ngày chấm dứt ít nhất 10 ngày. Đồng thời bên vi phạm sẽ bị phạt 8% giá trị hợp đồng.',
    '6.5. Khi chấm dứt Hợp đồng theo Điều 6 của Hợp đồng này, Hai Bên cam kết sẽ hoàn tất toàn bộ nghĩa vụ còn tồn đọng của mình trong vòng tối đa hai mươi (20) ngày kể từ ngày Hợp đồng chấm dứt. Việc chấm dứt hợp đồng không làm ảnh hưởng đến trách nhiệm bồi thường thiệt hại, phạt vi phạm hợp đồng của các Bên.',
  ],
  article7Heading: 'ĐIỀU 7: BẤT KHẢ KHÁNG.',
  article7: [
    '7.1. Sự kiện bất khả kháng là sự kiện xảy ra mang tính khách quan và nằm ngoài tầm kiểm soát của các bên như: động đất, bão, lũ lụt, hoả hoạn, chiến tranh hoặc các nguy cơ xảy ra chiến tranh và các thảm họa khác chưa lường hết được, sự thay đổi chính sách hoặc ngăn cấm của cơ quan có thẩm quyền của Việt Nam; Mặt bằng thi công bị vướng mắc khiếu nại, khiếu kiện; phá rối, cản trở của người dân và các hành vi phá hoại, cản trở khác ngoài tầm kiểm soát khác của các bên,….',
    '7.2. Trường hợp một bên không hoàn thành nghĩa vụ của mình do sự kiện bất khả kháng sẽ không phải là cơ sở để bên kia chấm dứt Hợp Đồng. Tuy nhiên bên bị ảnh hưởng của sự kiện bất khả kháng có nhiệm vụ phải thông báo cho bên kia về sự kiện bất khả kháng trong vòng bảy (7) ngày ngay sau khi sự kiện bất khả kháng xảy ra.',
    '7.3. Trong trường hợp xảy ra sự kiện bất khả kháng, thời gian thực hiện Hợp Đồng sẽ được kéo dài bằng thời gian diễn ra sự kiện bất khả kháng mà bên bị ảnh hưởng không thể thực hiện được nghĩa vụ của mình theo Hợp đồng.',
    '7.4. Nếu việc thực hiện Hợp đồng tiếp tục bị ngăn cản trong vòng 60 (sáu mươi) ngày do sự kiện bất khả kháng, một trong các bên có thể gửi thông báo chấm dứt Hợp đồng cho bên kia, thông báo này có hiệu lực trong vòng mười lăm (15) ngày. Nếu hết hạn mười lăm (15) ngày nhưng tác động của sự kiện bất khả kháng vẫn tiếp tục thì Hợp Đồng sẽ tự động chấm dứt và khi đó:',
    'Bên B sẽ báo cáo giá trị công việc đã thực hiện và Bên A sẽ thanh toán toàn bộ giá trị các công việc đã được thực hiện cho Bên B theo đơn giá trong Hợp Đồng;',
  ],
  article8Heading: 'ĐIỀU 8: ĐIỀU KHOẢN CHUNG.',
  article8: [
    '8.1. Hợp đồng thi công này có hiệu lực kể từ ngày ký và được điều chỉnh bởi pháp luật Việt Nam.',
    '8.2. Hai bên cam kết thực hiện đúng những điều khoản đã thỏa thuận trong Hợp đồng. Mọi thay đổi, bổ sung phải được hai bên thỏa thuận thống nhất bằng văn bản. Phần sửa đổi, bổ sung sẽ là một phần không thể tách rời của Hợp đồng.',
    '8.3 Trong trường hợp bên B đã thi công hoàn thiện công trình bên A không thanh toán đủ theo điều 3 của hợp đồng bên B có quyền tháo dở vật tư chính đã thi công lắp đặt',
    '8.4. Nếu có tranh chấp hoặc vi phạm hợp đồng thì cùng nhau bàn bạc thống nhất trên tinh thần hợp tác giải quyết, nếu không giải quyết được thì yêu cầu cơ quan có thẩm quyền giải quyết và bên vi phạm hợp đồng phải chịu mọi chi phí.',
    '8.5. Hợp đồng thi công này được lập thành hai (02) bản chính bằng tiếng Việt, mỗi bên giữ một (01) bản chính có giá trị pháp lý như nhau.',
  ],
  signA: 'ĐẠI DIỆN BÊN A',
  signB: 'ĐẠI DIỆN BÊN B',
} as const;
